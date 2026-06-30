# AppName

.NET MAUI app hosting a React (Vite + TypeScript) UI via `HybridWebView`,
structured with clean architecture.

## Layout

```
src/
  AppName.Domain/         — entities, value objects, domain interfaces (no dependencies)
  AppName.Application/    — use cases, DTOs, ports (depends on Domain only)
  AppName.Infrastructure/ — EF Core/SQLite repository, DI wiring (implements ports)
  AppName.Maui/           — MAUI host, HybridWebView, JS↔C# bridge, DI composition root
  web/                    — React + Vite + TypeScript UI (builds into AppName.Maui/Resources/Raw/web)
tests/
  AppName.Domain.Tests/
  AppName.Application.Tests/
  AppName.Infrastructure.Tests/
```

The `src/AppName.Maui/Resources/Raw/web` directory is gitignored; it is produced
by `npm run build` in `src/web`.

## Prerequisites

- **.NET 10 SDK** (`dotnet --version` → `10.x`)
- **MAUI workload:**
  - Linux: `dotnet workload install maui-android`
    (full `maui` workload is not supported on Linux; only `net10.0-android` builds on Linux)
  - Windows/macOS: `dotnet workload install maui`
    (installs all targets; iOS/Mac Catalyst require macOS; Windows target requires Windows)
- **Node 24+** and npm (for the React front-end)
- **Platform SDKs** for the targets you want to deploy to:
  - Android: Android SDK (required even on Linux)
  - iOS / Mac Catalyst: macOS + Xcode
  - Windows: Windows 10/11 + Windows App SDK

## Platform build matrix

| Target                | Linux | macOS | Windows |
|-----------------------|-------|-------|---------|
| `net10.0-android`     | yes   | yes   | yes     |
| `net10.0-ios`         | —     | yes   | —       |
| `net10.0-maccatalyst` | —     | yes   | —       |
| `net10.0-windows*`    | —     | —     | yes     |

The `.csproj` gates `ios`/`maccatalyst` behind `!IsOSPlatform('linux')` and
the Windows target behind `IsOSPlatform('windows')`.

## Run (bundled assets — production-like)

```bash
# Build the React app first (or let the MSBuild target do it automatically):
cd src/web && npm install && npm run build && cd ../..

# Then build and deploy the MAUI app for Android:
dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android
# Deploy/run via your IDE, or:
dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android -t:Run
```

The MAUI build automatically runs `npm install && npm run build` in `src/web`
via the `BuildReactApp` MSBuild target (`BeforeTargets="BeforeBuild"`).
Skip this step when using the Vite dev server: `-p:SkipReactBuild=true`.

## Develop the UI with hot reload (Vite dev server)

```bash
cd src/web && npm run dev      # serves at http://localhost:5173
```

Build MAUI with `-p:SkipReactBuild=true` to skip the Vite build step during
development. To point the `HybridWebView` at the dev server, add a dev-time
URL override in `MainPage` (see the comment stub there).

## Test

```bash
# C# — build each test project then run (single-process to avoid OOM on constrained hosts):
export DOTNET_CLI_TELEMETRY_OPTOUT=1 MSBUILDDISABLENODEREUSE=1 DOTNET_CLI_USE_MSBUILD_SERVER=0
dotnet build tests/AppName.Domain.Tests -m:1
dotnet test  tests/AppName.Domain.Tests --no-build -m:1          # 4 tests

dotnet build tests/AppName.Application.Tests -m:1
dotnet test  tests/AppName.Application.Tests --no-build -m:1     # 2 tests

dotnet build tests/AppName.Infrastructure.Tests -m:1
dotnet test  tests/AppName.Infrastructure.Tests --no-build -m:1  # 1 test

# React + bridge client
cd src/web && npm test          # 2 tests (Vitest)
```

## The JS↔C# bridge

`HybridWebView` injects a `HybridWebView.InvokeDotNet(methodName, args)` global
into the web page. The bridge target is `UsersBridge` (registered as a transient
in `MauiProgram`), set via `HybridView.SetInvokeJavaScriptTarget(usersBridge)` in
`MainPage`.

**C# side** — `src/AppName.Maui/Bridge/UsersBridge.cs`:

| Method | Signature | Description |
|--------|-----------|-------------|
| `GetUsers` | `Task<IReadOnlyList<UserDto>> GetUsers()` | Returns all users from the SQLite repository |
| `AddUser` | `Task<UserDto> AddUser(string name, string email)` | Creates and persists a new user |

**TypeScript side** — `src/web/src/bridge/`:

- `types.ts` — mirrors `AppName.Application.Dtos.UserDto` as a TS interface
  (`id: string`, `name: string`, `email: string` — camelCase)
- `client.ts` — typed wrapper around `InvokeDotNet`:
  - `bridge.users.getAll()` → invokes `"GetUsers"`
  - `bridge.users.add(name, email)` → invokes `"AddUser"`

**Keeping types in sync:** C# `UserDto(Guid Id, string Name, string Email)` (PascalCase)
maps to TS `UserDto { id, name, email }` (camelCase). When you add new DTOs or
bridge methods, update both `AppName.Application/Dtos/` and `src/web/src/bridge/types.ts`
by hand.

## Known issues

### NU1903 — SQLitePCLRaw.lib.e_sqlite3 vulnerability advisory

Restoring any project that transitively pulls in EF Core SQLite will surface:

```
warning NU1903: Package 'SQLitePCLRaw.lib.e_sqlite3' 2.1.10 has a known high severity
vulnerability, https://github.com/advisories/GHSA-2m69-gcr7-jv3q
```

This advisory (GHSA-2m69-gcr7-jv3q) currently affects **all published versions** of
`SQLitePCLRaw.lib.e_sqlite3` — there is no upstream patch. It is an inherent
consequence of using EF Core SQLite today. Options:

1. **Accept for now** — treat it as a known advisory and monitor for an upstream release.
2. **Suppress the audit warning** — add `<NuGetAuditSuppress>` to `Directory.Packages.props`
   once you have assessed the risk for your deployment context.
3. **Switch DB provider** — replace EF Core SQLite with another provider
   (e.g. EF Core InMemory for development/testing, or a different SQLite binding).

## Build tips for memory-constrained machines

MSBuild can OOM on machines with limited RAM when it spawns multiple worker nodes.
Use single-process mode for all builds:

```bash
export DOTNET_CLI_USE_MSBUILD_SERVER=0
export MSBUILDDISABLENODEREUSE=1
dotnet build <proj> -m:1
```

If you hit `MSB1025` (exit code 137 / OOM), also run:

```bash
dotnet build-server shutdown
```

then retry with the flags above.
