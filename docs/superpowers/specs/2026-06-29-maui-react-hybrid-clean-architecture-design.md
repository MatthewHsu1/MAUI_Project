# MAUI + React HybridWebView with Clean Architecture — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)

## Goal

Scaffold a cross-platform .NET MAUI application that hosts a React UI via MAUI's
native `HybridWebView` control, organized with clean-architecture separation
(Domain / Application / Infrastructure / Host) on the C# side and a structured
Vite + TypeScript React app on the web side.

## Key Decisions

| Decision | Choice |
| --- | --- |
| Web framework | React (Vite + TypeScript) |
| MAUI web host | Native `HybridWebView` (not Blazor `BlazorWebView`) |
| Logic split | Balanced — full C# layering **and** a structured React app |
| Infrastructure scope | Local DB (SQLite/EF Core), Remote API (HTTP), Native device features, Auth + secure storage |
| Target platforms | All MAUI targets: Android, iOS, Windows, macOS (Mac Catalyst) |
| Repo layout | Single repo, `src/` layout |
| App name | Placeholder `AppName` (rename later) |
| Toolchain present | .NET 10 SDK (10.0.109), Node v24.16.0. MAUI workload **not yet installed**. |

## 1. Solution & Folder Structure

```
AppName/
├─ AppName.sln
├─ Directory.Build.props          # shared C# props (nullable, langversion, etc.)
├─ Directory.Packages.props       # central NuGet version management
├─ global.json                    # pin .NET SDK
├─ .editorconfig
├─ src/
│  ├─ AppName.Domain/             # entities, value objects, domain interfaces — ZERO deps
│  ├─ AppName.Application/         # use cases, DTOs, ports (interfaces) — depends on Domain only
│  ├─ AppName.Infrastructure/      # EF Core/SQLite, HTTP clients, auth, native adapters
│  ├─ AppName.Maui/               # MAUI host: HybridWebView, DI wiring, JS bridge, platform code
│  │  └─ Resources/Raw/web/       # ← Vite build output lands here (served to HybridWebView)
│  └─ web/                        # React + Vite + TS source (own package.json)
└─ tests/
   ├─ AppName.Domain.Tests/
   ├─ AppName.Application.Tests/
   └─ AppName.Infrastructure.Tests/
```

**Dependency rule:** `Domain ← Application ← Infrastructure ← Maui`.
- Domain depends on nothing.
- Application depends only on Domain and defines *ports* (interfaces).
- Infrastructure implements those ports.
- Maui is the composition root: wires DI and hosts the web view.
- Dependencies only point inward; no inner layer references an outer one.

## 2. C# Layer Responsibilities

### Domain (`AppName.Domain`)
- `Entities/`, `ValueObjects/`, `Enums/`, `Exceptions/`
- Repository/service **interfaces** expressing domain needs
- No EF, no HTTP, no MAUI references

### Application (`AppName.Application`)
- `UseCases/` (or `Features/` vertical slices)
- `Dtos/` — data contracts (mirrored in TS on the web side)
- `Ports/` — interfaces Infrastructure implements: `IUserRepository`,
  `IRemoteApi`, `ISecureStore`, `IFileService`, etc.
- `Behaviors/` — cross-cutting concerns
- Depends only on Domain; framework-agnostic

### Infrastructure (`AppName.Infrastructure`)
- `Persistence/` — EF Core `DbContext`, SQLite, migrations, repository impls
- `Http/` — typed `HttpClient` clients implementing remote ports
- `Auth/` — token flow + `SecureStorage`
- `Native/` — MAUI Essentials adapters (files, notifications, sensors)
- `DependencyInjection.cs` — extension method registering all the above

### Maui (`AppName.Maui`)
- `MauiProgram.cs` — composition root (registers Application + Infrastructure)
- `Bridge/` — the JS↔C# contract (thin; no business logic)
- `Platforms/` — Android / iOS / Windows / MacCatalyst
- `MainPage` — hosts the `HybridWebView`

## 3. JS ↔ C# Bridge

- **C# side:** `Bridge/` folder exposes invokable methods to JS via
  `HybridWebView` (`InvokeJavaScriptAsync` + `RawMessageReceived` / JS-invokes-C#).
  Each bridge method is thin: deserialize request → call an **Application use case**
  → serialize result. No business logic in the bridge.
- **Contract:** C# DTOs live in Application; TypeScript mirror types live in
  `web/src/bridge/types.ts`. Manual mirroring initially (kept small); can
  auto-generate later if it grows.
- **TS side:** `web/src/bridge/` wraps raw `window.HybridWebView` calls in a
  clean typed client (e.g. `bridge.users.getAll(): Promise<UserDto[]>`), so React
  components never touch the raw bridge.

## 4. React App Structure (`src/web/`)

```
web/
├─ package.json, vite.config.ts, tsconfig.json
├─ index.html
└─ src/
   ├─ main.tsx, App.tsx
   ├─ bridge/          # typed C# bridge client + mirror types
   ├─ features/        # feature-based folders (components + hooks + state per feature)
   ├─ components/      # shared/presentational components
   ├─ hooks/           # shared hooks
   ├─ lib/             # utils, formatting
   └─ styles/
```

Vite `build.outDir` → `../AppName.Maui/Resources/Raw/web/`. MAUI serves those
static assets to the `HybridWebView`.

## 5. Build Integration

- Maui `.csproj` gets an MSBuild target that runs `npm install` + `npm run build`
  in `src/web/` before the MAUI build, so the latest React bundle is always
  bundled. Toggleable (so Vite can run separately while iterating).
- Dev loop: run the Vite dev server and point the `HybridWebView` at `localhost`
  during development for hot reload; switch to bundled assets for release. Both
  documented.

## 6. Testing

- **C#:** xUnit per layer. Domain + Application are pure and easy to test.
  Infrastructure tested with SQLite in-memory and mocked HTTP.
- **React:** Vitest + React Testing Library (Vite-native).
- **Bridge seam:** test use cases directly in C#; test the TS bridge client
  against a mocked `window.HybridWebView`.

## Prerequisites / Notes

- MAUI workload must be installed: `dotnet workload install maui`.
- All-target builds require platform SDKs (Android SDK; iOS/macOS builds require
  a Mac). Windows builds run on Windows. The scaffold will compile cross-platform
  per the usual MAUI constraints.
