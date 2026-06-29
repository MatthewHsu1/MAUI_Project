# MAUI + React HybridWebView Clean-Architecture Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a cross-platform .NET MAUI app that hosts a React (Vite + TypeScript) UI through the native `HybridWebView`, organized with Domain / Application / Infrastructure / Host clean-architecture layering and an end-to-end JS↔C# bridge demonstrated by one working vertical slice.

**Architecture:** Four C# projects with strictly inward dependencies (`Domain ← Application ← Infrastructure ← Maui`). Application defines ports (interfaces); Infrastructure implements them (EF Core/SQLite, HTTP, auth, native). The Maui project is the composition root and hosts the `HybridWebView`. React lives in `src/web`, builds with Vite into the Maui project's `Resources/Raw/web`, and talks to C# through a thin typed bridge.

**Tech Stack:** .NET 10, .NET MAUI, EF Core + SQLite, xUnit, React 18, Vite, TypeScript, Vitest + React Testing Library.

## Global Constraints

- .NET SDK: 10.x (pin via `global.json`; installed: 10.0.109). One line per constraint, values verbatim.
- Node: v24.16.0 (installed).
- MAUI workload required: `dotnet workload install maui` before building the Maui project.
- App name placeholder: `AppName` (used in every namespace, project name, and path below).
- Dependency rule: no inner layer references an outer one. Domain references nothing. Application references Domain only. Infrastructure references Application (+ Domain). Maui references Application + Infrastructure.
- Target frameworks for `AppName.Maui`: `net10.0-android;net10.0-ios;net10.0-maccatalyst;net10.0-windows10.0.19041.0` (Windows TFM only built on Windows).
- Central NuGet versions via `Directory.Packages.props` (no inline `Version=` on `PackageReference`).
- **Host-platform note:** This dev machine is Linux. On Linux, only the `net10.0-android` target builds/runs; iOS/Mac Catalyst require macOS, Windows target requires Windows. Build/run verification steps below use Android (or `dotnet build` of the non-Maui projects, which are platform-neutral). Other targets are expected to compile on their respective hosts.
- TypeScript bridge DTOs mirror Application DTOs by hand; keep them in sync.

---

### Task 1: Repository foundation (solution + shared build config)

**Files:**
- Create: `AppName.sln`
- Create: `global.json`
- Create: `Directory.Build.props`
- Create: `Directory.Packages.props`
- Create: `.editorconfig`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a solution file later tasks add projects to; central package management (other tasks add `<PackageVersion>` entries here, not inline versions); shared C# language settings (`Nullable=enable`, `ImplicitUsings=enable`, `LangVersion=latest`).

- [ ] **Step 1: Pin the SDK**

Create `global.json`:

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

- [ ] **Step 2: Shared MSBuild props**

Create `Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
</Project>
```

- [ ] **Step 3: Central package versions (seed file)**

Create `Directory.Packages.props`:

```xml
<Project>
  <ItemGroup>
    <!-- Versions added by later tasks. Example shape: -->
    <!-- <PackageVersion Include="Microsoft.EntityFrameworkCore.Sqlite" Version="..." /> -->
  </ItemGroup>
</Project>
```

- [ ] **Step 4: .editorconfig and .gitignore**

Create `.editorconfig`:

```ini
root = true

[*.cs]
indent_style = space
indent_size = 4
dotnet_sort_system_directives_first = true

[*.{ts,tsx,js,jsx,json}]
indent_style = space
indent_size = 2
```

Create `.gitignore` (covers .NET, MAUI, Node):

```gitignore
# .NET
bin/
obj/
*.user
.vs/

# MAUI / mobile
*.binlog

# Node / Vite
node_modules/
dist/
src/AppName.Maui/Resources/Raw/web/

# OS
.DS_Store
```

- [ ] **Step 5: Create the empty solution**

Run: `dotnet new sln -n AppName`
Expected: `AppName.sln` created.

- [ ] **Step 6: Verify and commit**

Run: `dotnet sln list`
Expected: "No projects found in the solution." (prints header without error)

```bash
git add global.json Directory.Build.props Directory.Packages.props .editorconfig .gitignore AppName.sln
git commit -m "chore: scaffold solution and shared build config"
```

---

### Task 2: Domain project + sample entity

**Files:**
- Create: `src/AppName.Domain/AppName.Domain.csproj`
- Create: `src/AppName.Domain/Entities/User.cs`
- Create: `src/AppName.Domain/Abstractions/IUserRepository.cs`
- Test: `tests/AppName.Domain.Tests/AppName.Domain.Tests.csproj`
- Test: `tests/AppName.Domain.Tests/UserTests.cs`

**Interfaces:**
- Consumes: shared props from Task 1.
- Produces:
  - `AppName.Domain.Entities.User` with constructor `User(Guid id, string name, string email)`; properties `Guid Id`, `string Name`, `string Email`; method `void Rename(string newName)` (throws `ArgumentException` on null/whitespace).
  - `AppName.Domain.Abstractions.IUserRepository` with `Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)` and `Task AddAsync(User user, CancellationToken ct = default)`.

- [ ] **Step 1: Create the Domain project (no dependencies)**

Run:
```bash
dotnet new classlib -n AppName.Domain -o src/AppName.Domain -f net10.0
dotnet sln add src/AppName.Domain/AppName.Domain.csproj
rm src/AppName.Domain/Class1.cs
```
Expected: project created and added to solution.

- [ ] **Step 2: Create the test project and add xUnit versions**

Run:
```bash
dotnet new xunit -n AppName.Domain.Tests -o tests/AppName.Domain.Tests -f net10.0
dotnet sln add tests/AppName.Domain.Tests/AppName.Domain.Tests.csproj
dotnet add tests/AppName.Domain.Tests/AppName.Domain.Tests.csproj reference src/AppName.Domain/AppName.Domain.csproj
```

Ensure xUnit packages use central versions. In `Directory.Packages.props`, add inside `<ItemGroup>`:

```xml
<PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
<PackageVersion Include="xunit" Version="2.9.2" />
<PackageVersion Include="xunit.runner.visualstudio" Version="2.8.2" />
<PackageVersion Include="coverlet.collector" Version="6.0.2" />
```

Then strip inline versions from `tests/AppName.Domain.Tests/AppName.Domain.Tests.csproj` (remove `Version="..."` from each `PackageReference`).

- [ ] **Step 3: Write the failing test**

Create `tests/AppName.Domain.Tests/UserTests.cs`:

```csharp
using AppName.Domain.Entities;

namespace AppName.Domain.Tests;

public class UserTests
{
    [Fact]
    public void Rename_WithValidName_UpdatesName()
    {
        var user = new User(Guid.NewGuid(), "Old Name", "a@b.com");

        user.Rename("New Name");

        Assert.Equal("New Name", user.Name);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Rename_WithBlankName_Throws(string blank)
    {
        var user = new User(Guid.NewGuid(), "Old Name", "a@b.com");

        Assert.Throws<ArgumentException>(() => user.Rename(blank));
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `dotnet test tests/AppName.Domain.Tests`
Expected: FAIL — `User` type does not exist (compile error).

- [ ] **Step 5: Implement the entity and the repository port**

Create `src/AppName.Domain/Entities/User.cs`:

```csharp
namespace AppName.Domain.Entities;

public sealed class User
{
    public User(Guid id, string name, string email)
    {
        Id = id;
        Name = name;
        Email = email;
    }

    public Guid Id { get; }
    public string Name { get; private set; }
    public string Email { get; }

    public void Rename(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("Name cannot be blank.", nameof(newName));
        Name = newName;
    }
}
```

Create `src/AppName.Domain/Abstractions/IUserRepository.cs`:

```csharp
using AppName.Domain.Entities;

namespace AppName.Domain.Abstractions;

public interface IUserRepository
{
    Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(User user, CancellationToken ct = default);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `dotnet test tests/AppName.Domain.Tests`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/AppName.Domain tests/AppName.Domain.Tests Directory.Packages.props AppName.sln
git commit -m "feat(domain): add User entity and IUserRepository port"
```

---

### Task 3: Application project + use case, DTO, port

**Files:**
- Create: `src/AppName.Application/AppName.Application.csproj`
- Create: `src/AppName.Application/Dtos/UserDto.cs`
- Create: `src/AppName.Application/UseCases/Users/GetUsersUseCase.cs`
- Create: `src/AppName.Application/UseCases/Users/AddUserUseCase.cs`
- Create: `src/AppName.Application/DependencyInjection.cs`
- Test: `tests/AppName.Application.Tests/AppName.Application.Tests.csproj`
- Test: `tests/AppName.Application.Tests/GetUsersUseCaseTests.cs`

**Interfaces:**
- Consumes: `AppName.Domain.Entities.User`, `AppName.Domain.Abstractions.IUserRepository`.
- Produces:
  - `AppName.Application.Dtos.UserDto` record: `record UserDto(Guid Id, string Name, string Email)`.
  - `AppName.Application.UseCases.Users.GetUsersUseCase` with ctor `(IUserRepository repo)` and `Task<IReadOnlyList<UserDto>> ExecuteAsync(CancellationToken ct = default)`.
  - `AppName.Application.UseCases.Users.AddUserUseCase` with ctor `(IUserRepository repo)` and `Task<UserDto> ExecuteAsync(string name, string email, CancellationToken ct = default)`.
  - `AppName.Application.DependencyInjection.AddApplication(this IServiceCollection services)` registering both use cases as transient.

- [ ] **Step 1: Create the Application project referencing Domain + DI abstractions**

Run:
```bash
dotnet new classlib -n AppName.Application -o src/AppName.Application -f net10.0
dotnet sln add src/AppName.Application/AppName.Application.csproj
rm src/AppName.Application/Class1.cs
dotnet add src/AppName.Application/AppName.Application.csproj reference src/AppName.Domain/AppName.Domain.csproj
dotnet add src/AppName.Application/AppName.Application.csproj package Microsoft.Extensions.DependencyInjection.Abstractions
```

Add to `Directory.Packages.props`:

```xml
<PackageVersion Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="9.0.0" />
```
Then remove the inline `Version=` the `dotnet add package` wrote into the csproj.

- [ ] **Step 2: Create the test project**

Run:
```bash
dotnet new xunit -n AppName.Application.Tests -o tests/AppName.Application.Tests -f net10.0
dotnet sln add tests/AppName.Application.Tests/AppName.Application.Tests.csproj
dotnet add tests/AppName.Application.Tests/AppName.Application.Tests.csproj reference src/AppName.Application/AppName.Application.csproj
dotnet add tests/AppName.Application.Tests/AppName.Application.Tests.csproj reference src/AppName.Domain/AppName.Domain.csproj
```
Remove inline xUnit `Version=` entries (they resolve from central versions added in Task 2).

- [ ] **Step 3: Write the failing test (hand-rolled fake repo, no mocking lib)**

Create `tests/AppName.Application.Tests/GetUsersUseCaseTests.cs`:

```csharp
using AppName.Application.UseCases.Users;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.Tests;

public class GetUsersUseCaseTests
{
    private sealed class FakeUserRepository : IUserRepository
    {
        private readonly List<User> _users = new();
        public Task AddAsync(User user, CancellationToken ct = default)
        {
            _users.Add(user);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<User>>(_users);
    }

    [Fact]
    public async Task ExecuteAsync_MapsEntitiesToDtos()
    {
        var repo = new FakeUserRepository();
        await repo.AddAsync(new User(Guid.NewGuid(), "Ada", "ada@x.com"));
        var sut = new GetUsersUseCase(repo);

        var result = await sut.ExecuteAsync();

        var dto = Assert.Single(result);
        Assert.Equal("Ada", dto.Name);
        Assert.Equal("ada@x.com", dto.Email);
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `dotnet test tests/AppName.Application.Tests`
Expected: FAIL — `GetUsersUseCase` / `UserDto` do not exist.

- [ ] **Step 5: Implement DTO and use cases**

Create `src/AppName.Application/Dtos/UserDto.cs`:

```csharp
namespace AppName.Application.Dtos;

public record UserDto(Guid Id, string Name, string Email);
```

Create `src/AppName.Application/UseCases/Users/GetUsersUseCase.cs`:

```csharp
using AppName.Application.Dtos;
using AppName.Domain.Abstractions;

namespace AppName.Application.UseCases.Users;

public sealed class GetUsersUseCase
{
    private readonly IUserRepository _repo;
    public GetUsersUseCase(IUserRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<UserDto>> ExecuteAsync(CancellationToken ct = default)
    {
        var users = await _repo.GetAllAsync(ct);
        return users.Select(u => new UserDto(u.Id, u.Name, u.Email)).ToList();
    }
}
```

Create `src/AppName.Application/UseCases/Users/AddUserUseCase.cs`:

```csharp
using AppName.Application.Dtos;
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;

namespace AppName.Application.UseCases.Users;

public sealed class AddUserUseCase
{
    private readonly IUserRepository _repo;
    public AddUserUseCase(IUserRepository repo) => _repo = repo;

    public async Task<UserDto> ExecuteAsync(string name, string email, CancellationToken ct = default)
    {
        var user = new User(Guid.NewGuid(), name, email);
        await _repo.AddAsync(user, ct);
        return new UserDto(user.Id, user.Name, user.Email);
    }
}
```

Create `src/AppName.Application/DependencyInjection.cs`:

```csharp
using AppName.Application.UseCases.Users;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddTransient<GetUsersUseCase>();
        services.AddTransient<AddUserUseCase>();
        return services;
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `dotnet test tests/AppName.Application.Tests`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/AppName.Application tests/AppName.Application.Tests Directory.Packages.props AppName.sln
git commit -m "feat(application): add user use cases, DTO, and DI registration"
```

---

### Task 4: Infrastructure project (EF Core/SQLite repo + DI)

**Files:**
- Create: `src/AppName.Infrastructure/AppName.Infrastructure.csproj`
- Create: `src/AppName.Infrastructure/Persistence/AppDbContext.cs`
- Create: `src/AppName.Infrastructure/Persistence/UserRepository.cs`
- Create: `src/AppName.Infrastructure/DependencyInjection.cs`
- Test: `tests/AppName.Infrastructure.Tests/AppName.Infrastructure.Tests.csproj`
- Test: `tests/AppName.Infrastructure.Tests/UserRepositoryTests.cs`

**Interfaces:**
- Consumes: `IUserRepository`, `User` (Domain); `AddApplication` (Application).
- Produces:
  - `AppName.Infrastructure.Persistence.AppDbContext : DbContext` with `DbSet<User> Users`.
  - `AppName.Infrastructure.Persistence.UserRepository : IUserRepository`.
  - `AppName.Infrastructure.DependencyInjection.AddInfrastructure(this IServiceCollection services, string dbPath)` — registers `AppDbContext` (SQLite at `dbPath`) and `IUserRepository → UserRepository` scoped.

- [ ] **Step 1: Create the Infrastructure project**

Run:
```bash
dotnet new classlib -n AppName.Infrastructure -o src/AppName.Infrastructure -f net10.0
dotnet sln add src/AppName.Infrastructure/AppName.Infrastructure.csproj
rm src/AppName.Infrastructure/Class1.cs
dotnet add src/AppName.Infrastructure/AppName.Infrastructure.csproj reference src/AppName.Application/AppName.Application.csproj
dotnet add src/AppName.Infrastructure/AppName.Infrastructure.csproj reference src/AppName.Domain/AppName.Domain.csproj
```

Add EF Core SQLite. In `Directory.Packages.props` add:

```xml
<PackageVersion Include="Microsoft.EntityFrameworkCore.Sqlite" Version="9.0.0" />
```
Then reference it (no inline version):

```bash
dotnet add src/AppName.Infrastructure/AppName.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Sqlite
```
Remove the inline `Version=` it adds.

- [ ] **Step 2: Create the test project**

Run:
```bash
dotnet new xunit -n AppName.Infrastructure.Tests -o tests/AppName.Infrastructure.Tests -f net10.0
dotnet sln add tests/AppName.Infrastructure.Tests/AppName.Infrastructure.Tests.csproj
dotnet add tests/AppName.Infrastructure.Tests/AppName.Infrastructure.Tests.csproj reference src/AppName.Infrastructure/AppName.Infrastructure.csproj
dotnet add tests/AppName.Infrastructure.Tests/AppName.Infrastructure.Tests.csproj reference src/AppName.Domain/AppName.Domain.csproj
```
Remove inline xUnit versions.

- [ ] **Step 3: Write the failing test (SQLite file in temp dir, real round-trip)**

Create `tests/AppName.Infrastructure.Tests/UserRepositoryTests.cs`:

```csharp
using AppName.Domain.Entities;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Tests;

public class UserRepositoryTests
{
    private static AppDbContext NewContext(string dbPath)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;
        var ctx = new AppDbContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }

    [Fact]
    public async Task AddAsync_ThenGetAllAsync_ReturnsPersistedUser()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.db");
        try
        {
            await using var ctx = NewContext(dbPath);
            var repo = new UserRepository(ctx);

            await repo.AddAsync(new User(Guid.NewGuid(), "Ada", "ada@x.com"));
            var all = await repo.GetAllAsync();

            var user = Assert.Single(all);
            Assert.Equal("Ada", user.Name);
        }
        finally
        {
            if (File.Exists(dbPath)) File.Delete(dbPath);
        }
    }
}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `dotnet test tests/AppName.Infrastructure.Tests`
Expected: FAIL — `AppDbContext` / `UserRepository` do not exist.

- [ ] **Step 5: Implement DbContext, repository, and DI**

Create `src/AppName.Infrastructure/Persistence/AppDbContext.cs`:

```csharp
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.HasKey(u => u.Id);
        user.Property(u => u.Name).IsRequired();
        user.Property(u => u.Email).IsRequired();
    }
}
```

Create `src/AppName.Infrastructure/Persistence/UserRepository.cs`:

```csharp
using AppName.Domain.Abstractions;
using AppName.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AppName.Infrastructure.Persistence;

public sealed class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    public async Task AddAsync(User user, CancellationToken ct = default)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
        => await _db.Users.AsNoTracking().ToListAsync(ct);
}
```

Create `src/AppName.Infrastructure/DependencyInjection.cs`:

```csharp
using AppName.Domain.Abstractions;
using AppName.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AppName.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string dbPath)
    {
        services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
        services.AddScoped<IUserRepository, UserRepository>();
        return services;
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `dotnet test tests/AppName.Infrastructure.Tests`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/AppName.Infrastructure tests/AppName.Infrastructure.Tests Directory.Packages.props AppName.sln
git commit -m "feat(infrastructure): add EF Core SQLite UserRepository and DI"
```

---

### Task 5: MAUI host project with HybridWebView

**Files:**
- Create: `src/AppName.Maui/AppName.Maui.csproj` (via template, then edited)
- Modify: `src/AppName.Maui/MauiProgram.cs`
- Create: `src/AppName.Maui/MainPage.xaml`
- Create: `src/AppName.Maui/MainPage.xaml.cs`
- Create: `src/AppName.Maui/Resources/Raw/web/index.html` (placeholder until React build)

**Interfaces:**
- Consumes: `AddApplication()` (Application), `AddInfrastructure(dbPath)` (Infrastructure).
- Produces: a running MAUI app whose `MainPage` contains a `HybridWebView` with `HybridRoot="web"` and `DefaultFile="index.html"`, serving files from `Resources/Raw/web`. DI configured in `MauiProgram`.

- [ ] **Step 1: Install the MAUI workload (one-time, host machine)**

Run: `dotnet workload install maui`
Expected: workload installs (or "already installed"). If offline/unavailable, stop and surface to the user — the rest of this task depends on it.

- [ ] **Step 2: Create the MAUI app from template**

Run:
```bash
dotnet new maui -n AppName.Maui -o src/AppName.Maui
dotnet sln add src/AppName.Maui/AppName.Maui.csproj
dotnet add src/AppName.Maui/AppName.Maui.csproj reference src/AppName.Application/AppName.Application.csproj
dotnet add src/AppName.Maui/AppName.Maui.csproj reference src/AppName.Infrastructure/AppName.Infrastructure.csproj
```
Then delete template sample files not used by this scaffold:
```bash
rm -f src/AppName.Maui/MainPage.xaml src/AppName.Maui/MainPage.xaml.cs
```
(We recreate `MainPage` below with the HybridWebView.)

- [ ] **Step 3: Replace MainPage with a HybridWebView host**

Create `src/AppName.Maui/MainPage.xaml`:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<ContentPage xmlns="http://schemas.microsoft.com/dotnet/2021/maui"
             xmlns:x="http://schemas.microsoft.com/winfx/2009/xaml"
             x:Class="AppName.Maui.MainPage">
    <HybridWebView x:Name="HybridView"
                   HybridRoot="web"
                   DefaultFile="index.html" />
</ContentPage>
```

Create `src/AppName.Maui/MainPage.xaml.cs`:

```csharp
namespace AppName.Maui;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
    }
}
```

- [ ] **Step 4: Wire DI in MauiProgram and register the HybridWebView control**

Replace `src/AppName.Maui/MauiProgram.cs` with:

```csharp
using AppName.Application;
using AppName.Infrastructure;
using Microsoft.Extensions.Logging;

namespace AppName.Maui;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
            });

        var dbPath = Path.Combine(FileSystem.AppDataDirectory, "app.db");
        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(dbPath);

        builder.Services.AddTransient<MainPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif
        return builder.Build();
    }
}
```

Ensure `App.xaml.cs` resolves `MainPage` from DI. Replace its `MainPage` assignment so the constructor takes `MainPage`:

```csharp
namespace AppName.Maui;

public partial class App : Application
{
    public App(MainPage mainPage)
    {
        InitializeComponent();
        MainPage = mainPage;
    }
}
```
And register `App` is already handled by `UseMauiApp<App>()`; `AppName.Maui` template wires `App` via DI automatically.

- [ ] **Step 5: Add a placeholder web asset (until React build exists)**

Create `src/AppName.Maui/Resources/Raw/web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>AppName</title></head>
  <body><h1>HybridWebView placeholder — React build replaces this.</h1></body>
</html>
```

Note: `.gitignore` ignores `Resources/Raw/web/`. Force-add this placeholder so the dir exists pre-build:
```bash
git add -f src/AppName.Maui/Resources/Raw/web/index.html
```

- [ ] **Step 6: Build the Android target to verify (Linux-compatible target)**

Run: `dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android`
Expected: BUILD SUCCEEDED. (If Android SDK is missing, install via `dotnet workload` / Android SDK manager, or build a non-Maui-restricted check by confirming the solution restores: `dotnet restore`.)

- [ ] **Step 7: Commit**

```bash
git add src/AppName.Maui AppName.sln
git add -f src/AppName.Maui/Resources/Raw/web/index.html
git commit -m "feat(maui): add MAUI host with HybridWebView and DI wiring"
```

---

### Task 6: C# bridge endpoint (HybridWebView → Application)

**Files:**
- Create: `src/AppName.Maui/Bridge/UsersBridge.cs`
- Modify: `src/AppName.Maui/MainPage.xaml.cs`

**Interfaces:**
- Consumes: `GetUsersUseCase`, `AddUserUseCase`, `UserDto` (Application); `HybridWebView` named `HybridView`.
- Produces: a JS-invokable C# object registered on the HybridWebView. Methods callable from JS:
  - `Task<IReadOnlyList<UserDto>> GetUsers()`
  - `Task<UserDto> AddUser(string name, string email)`

- [ ] **Step 1: Create the bridge object (thin; delegates to use cases)**

Create `src/AppName.Maui/Bridge/UsersBridge.cs`:

```csharp
using AppName.Application.Dtos;
using AppName.Application.UseCases.Users;

namespace AppName.Maui.Bridge;

// Methods on this object are invoked from JavaScript via HybridWebView.
public sealed class UsersBridge
{
    private readonly GetUsersUseCase _getUsers;
    private readonly AddUserUseCase _addUser;

    public UsersBridge(GetUsersUseCase getUsers, AddUserUseCase addUser)
    {
        _getUsers = getUsers;
        _addUser = addUser;
    }

    public Task<IReadOnlyList<UserDto>> GetUsers() => _getUsers.ExecuteAsync();

    public Task<UserDto> AddUser(string name, string email) => _addUser.ExecuteAsync(name, email);
}
```

- [ ] **Step 2: Register the bridge with the HybridWebView**

Replace `src/AppName.Maui/MainPage.xaml.cs`:

```csharp
using AppName.Maui.Bridge;

namespace AppName.Maui;

public partial class MainPage : ContentPage
{
    public MainPage(UsersBridge usersBridge)
    {
        InitializeComponent();
        HybridView.SetInvokeJavaScriptTarget(usersBridge);
    }
}
```

- [ ] **Step 3: Register the bridge in DI**

In `src/AppName.Maui/MauiProgram.cs`, add after `AddInfrastructure(...)`:

```csharp
builder.Services.AddTransient<AppName.Maui.Bridge.UsersBridge>();
```

- [ ] **Step 4: Build to verify the bridge compiles**

Run: `dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android`
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add src/AppName.Maui
git commit -m "feat(maui): add UsersBridge JS<->C# endpoint"
```

---

### Task 7: React app (Vite + TypeScript) with typed bridge client

**Files:**
- Create: `src/web/package.json`, `src/web/vite.config.ts`, `src/web/tsconfig.json`, `src/web/tsconfig.node.json`, `src/web/index.html`
- Create: `src/web/src/main.tsx`, `src/web/src/App.tsx`
- Create: `src/web/src/bridge/types.ts`, `src/web/src/bridge/client.ts`
- Create: `src/web/src/features/users/UsersList.tsx`
- Create: `src/web/src/bridge/client.test.ts`
- Create: `src/web/vitest.config.ts`, `src/web/src/test/setup.ts`

**Interfaces:**
- Consumes: the C# bridge object exposed as `window.HybridWebView.InvokeDotNet(...)` (TS wraps this).
- Produces:
  - `bridge/types.ts`: `export interface UserDto { id: string; name: string; email: string; }` (mirrors C# `UserDto`).
  - `bridge/client.ts`: `export const bridge = { users: { getAll(): Promise<UserDto[]>, add(name: string, email: string): Promise<UserDto> } }`.
  - Vite builds to `../AppName.Maui/Resources/Raw/web`.

- [ ] **Step 1: Scaffold the Vite React-TS app**

Run:
```bash
cd src/web && npm create vite@latest . -- --template react-ts
```
(If `src/web` already has the placeholder dir, run in an empty `src/web`; accept overwrite of `index.html`.) Then:
```bash
cd src/web && npm install
```

- [ ] **Step 2: Point Vite build output at the MAUI Raw assets and set relative base**

Replace `src/web/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// HybridWebView serves from a virtual root; assets must use relative paths.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../AppName.Maui/Resources/Raw/web",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Add Vitest + Testing Library**

Run:
```bash
cd src/web && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create `src/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

Create `src/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom";
```

Add scripts to `src/web/package.json` (`scripts` section):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing bridge-client test**

Create `src/web/src/bridge/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { bridge } from "./client";
import type { UserDto } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var HybridWebView: { InvokeDotNet: (name: string, args?: unknown[]) => Promise<unknown> };
}

describe("bridge.users", () => {
  beforeEach(() => {
    globalThis.HybridWebView = { InvokeDotNet: vi.fn() };
  });

  it("getAll calls GetUsers and returns the result", async () => {
    const fake: UserDto[] = [{ id: "1", name: "Ada", email: "ada@x.com" }];
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue(fake);

    const result = await bridge.users.getAll();

    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("GetUsers");
    expect(result).toEqual(fake);
  });

  it("add calls AddUser with name and email", async () => {
    const created: UserDto = { id: "2", name: "Bob", email: "bob@x.com" };
    (globalThis.HybridWebView.InvokeDotNet as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await bridge.users.add("Bob", "bob@x.com");

    expect(globalThis.HybridWebView.InvokeDotNet).toHaveBeenCalledWith("AddUser", ["Bob", "bob@x.com"]);
    expect(result).toEqual(created);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd src/web && npm test`
Expected: FAIL — `./client` and `./types` not found.

- [ ] **Step 6: Implement the typed bridge types and client**

Create `src/web/src/bridge/types.ts`:

```ts
// Mirrors AppName.Application.Dtos.UserDto — keep in sync by hand.
export interface UserDto {
  id: string;
  name: string;
  email: string;
}
```

Create `src/web/src/bridge/client.ts`:

```ts
import type { UserDto } from "./types";

// HybridWebView injects this global at runtime.
declare const HybridWebView: {
  InvokeDotNet: (methodName: string, args?: unknown[]) => Promise<unknown>;
};

function invoke<T>(method: string, args?: unknown[]): Promise<T> {
  return HybridWebView.InvokeDotNet(method, args) as Promise<T>;
}

export const bridge = {
  users: {
    getAll: (): Promise<UserDto[]> => invoke<UserDto[]>("GetUsers"),
    add: (name: string, email: string): Promise<UserDto> =>
      invoke<UserDto>("AddUser", [name, email]),
  },
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd src/web && npm test`
Expected: PASS (2 tests).

- [ ] **Step 8: Build a sample feature that uses the bridge**

Create `src/web/src/features/users/UsersList.tsx`:

```tsx
import { useEffect, useState } from "react";
import { bridge } from "../../bridge/client";
import type { UserDto } from "../../bridge/types";

export function UsersList() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridge.users
      .getAll()
      .then(setUsers)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) return <p>Bridge error: {error}</p>;
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} — {u.email}
        </li>
      ))}
    </ul>
  );
}
```

Replace `src/web/src/App.tsx`:

```tsx
import { UsersList } from "./features/users/UsersList";

export default function App() {
  return (
    <main>
      <h1>AppName</h1>
      <UsersList />
    </main>
  );
}
```

- [ ] **Step 9: Build the React app into the MAUI Raw folder**

Run: `cd src/web && npm run build`
Expected: build succeeds; output appears in `src/AppName.Maui/Resources/Raw/web/` (`index.html` + `assets/`).

- [ ] **Step 10: Commit (source only; build output is gitignored)**

```bash
git add src/web
git commit -m "feat(web): add Vite React TS app with typed bridge client"
```

---

### Task 8: Build integration (React build runs before MAUI build)

**Files:**
- Modify: `src/AppName.Maui/AppName.Maui.csproj`

**Interfaces:**
- Consumes: `src/web` npm scripts (`build`).
- Produces: an MSBuild target `BuildReactApp` that runs `npm install` + `npm run build` in `src/web` before `Build`, gated by a `SkipReactBuild` property so devs can iterate against the Vite dev server.

- [ ] **Step 1: Add the MSBuild target**

In `src/AppName.Maui/AppName.Maui.csproj`, add before `</Project>`:

```xml
  <PropertyGroup>
    <!-- Set to true to skip the React build (e.g. when using the Vite dev server). -->
    <SkipReactBuild Condition="'$(SkipReactBuild)' == ''">false</SkipReactBuild>
    <WebAppDir>$(MSBuildProjectDirectory)/../web</WebAppDir>
  </PropertyGroup>

  <Target Name="BuildReactApp" BeforeTargets="BeforeBuild" Condition="'$(SkipReactBuild)' != 'true'">
    <Message Importance="high" Text="Building React app in $(WebAppDir)" />
    <Exec Command="npm install" WorkingDirectory="$(WebAppDir)" />
    <Exec Command="npm run build" WorkingDirectory="$(WebAppDir)" />
  </Target>
```

- [ ] **Step 2: Verify the target runs on build**

Run: `dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android`
Expected: log shows "Building React app in .../web"; BUILD SUCCEEDED; `Resources/Raw/web/index.html` is the React-built file.

- [ ] **Step 3: Verify the skip switch works**

Run: `dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android -p:SkipReactBuild=true`
Expected: log does NOT show "Building React app"; BUILD SUCCEEDED.

- [ ] **Step 4: Commit**

```bash
git add src/AppName.Maui/AppName.Maui.csproj
git commit -m "build(maui): run Vite build before MAUI build (toggleable)"
```

---

### Task 9: README with dev/run workflow and final solution verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documented dev loops (bundled vs Vite dev server) and a top-to-bottom verification.

- [ ] **Step 1: Write the README**

Create `README.md`:

````markdown
# AppName

.NET MAUI app hosting a React (Vite + TypeScript) UI via `HybridWebView`,
structured with clean architecture.

## Layout

- `src/AppName.Domain` — entities, value objects, domain interfaces (no deps)
- `src/AppName.Application` — use cases, DTOs, ports (depends on Domain)
- `src/AppName.Infrastructure` — EF Core/SQLite, HTTP, auth, native (implements ports)
- `src/AppName.Maui` — MAUI host, HybridWebView, JS↔C# bridge, DI composition root
- `src/web` — React + Vite + TypeScript UI (builds into `AppName.Maui/Resources/Raw/web`)
- `tests/*` — xUnit tests per C# layer

## Prerequisites

- .NET 10 SDK
- `dotnet workload install maui`
- Node 24+
- Platform SDKs for the targets you build (Android SDK; macOS for iOS/Mac Catalyst; Windows for the Windows target)

## Run (bundled assets — production-like)

```bash
dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android
# then deploy/run via your IDE or: dotnet build -t:Run -f net10.0-android
```

The MAUI build runs the Vite build automatically (see `BuildReactApp` target).

## Develop the UI with hot reload (Vite dev server)

```bash
cd src/web && npm run dev   # serves at http://localhost:5173
```
Build MAUI with `-p:SkipReactBuild=true` and point the HybridWebView source at
the dev server URL during development (see comment in `MainPage`).

## Test

```bash
dotnet test                 # all C# layers
cd src/web && npm test      # React + bridge client
```

## The JS↔C# bridge

C# methods on `UsersBridge` are invoked from JS via the typed client in
`src/web/src/bridge/client.ts`. C# DTOs in `AppName.Application/Dtos` are
mirrored in `src/web/src/bridge/types.ts` — keep them in sync.
````

- [ ] **Step 2: Full verification — all C# tests**

Run: `dotnet test`
Expected: all test projects PASS.

- [ ] **Step 3: Full verification — React tests + build**

Run: `cd src/web && npm test && npm run build`
Expected: tests PASS; build emits to `src/AppName.Maui/Resources/Raw/web`.

- [ ] **Step 4: Full verification — MAUI build**

Run: `dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android`
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with layout, dev loop, and bridge notes"
```

---

## Self-Review Notes

- **Spec coverage:** §1 solution/layout → Tasks 1–5; §2 layer responsibilities → Tasks 2 (Domain), 3 (Application), 4 (Infrastructure), 5 (Maui); §3 bridge → Tasks 6 (C#) + 7 (TS client/types); §4 React structure → Task 7; §5 build integration → Task 8; §6 testing → tests in Tasks 2/3/4/7 + verification in Task 9. Auth/HTTP/native infrastructure folders are represented by the persistence vertical slice as the proven pattern; additional ports (`IRemoteApi`, `ISecureStore`, `IFileService`) follow the same Domain-port → Infrastructure-impl shape and are noted for follow-up rather than fully built, to keep this scaffold to one working slice (YAGNI).
- **Placeholder scan:** no TBD/TODO; every code step contains full code.
- **Type consistency:** `UserDto(Guid Id, string Name, string Email)` ↔ TS `UserDto { id, name, email }`; bridge methods `GetUsers`/`AddUser` match C# `UsersBridge` method names and TS `invoke` call strings.
- **Scope note:** This is one cohesive scaffold producing a runnable app; not decomposed further.
