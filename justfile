set shell := ["bash", "-uc"]

export DOTNET_CLI_USE_MSBUILD_SERVER := "0"
export MSBUILDDISABLENODEREUSE := "1"

# MAUI target framework to build/run. On Linux only android is available;
# on Windows/Mac override, e.g. `just tfm=net10.0-maccatalyst build-maui`.
tfm := "net10.0-android"

# Default: list recipes.
default:
    @just --list

# ---- Tests -------------------------------------------------------------------

# Run all tests (C# three projects + the React/vitest suite).
test: test-cs test-web

# Run the three C# test projects single-proc.
test-cs:
    dotnet test tests/AppName.Domain.Tests -m:1
    dotnet test tests/AppName.Infrastructure.Tests -m:1
    dotnet test tests/AppName.Application.Tests -m:1

# Run the React unit tests (vitest).
test-web:
    cd src/web && npm test

# ---- React web app -----------------------------------------------------------

# Build the React bundle into src/AppName.Maui/Resources/Raw/web (what the MAUI build runs automatically).
web-build:
    cd src/web && npm install && npm run build

# Start the Vite dev server (use with `build-maui-noweb` + the dev URL while iterating on UI).
web-dev:
    cd src/web && npm run dev

# ---- MAUI app ----------------------------------------------------------------

# Build the MAUI head (builds the React bundle first via the BuildReactApp MSBuild target).
# Requires the Android SDK + MAUI workload: `dotnet workload install maui-android`.
build-maui:
    dotnet build src/AppName.Maui/AppName.Maui.csproj -f {{tfm}} -m:1

# Build the MAUI head WITHOUT rebuilding the React bundle (faster; use with `web-dev`).
build-maui-noweb:
    dotnet build src/AppName.Maui/AppName.Maui.csproj -f {{tfm}} -m:1 -p:SkipReactBuild=true

# Build + deploy + run the MAUI app on a connected device/emulator.
run-maui:
    dotnet build src/AppName.Maui/AppName.Maui.csproj -t:Run -f {{tfm}} -m:1

# ---- EF Core migrations ------------------------------------------------------

# Add a migration, e.g. `just migrate-add AddSomething` (offline; does not touch the database).
migrate-add name:
    dotnet ef migrations add {{name}} \
        --project src/AppName.Infrastructure \
        --startup-project src/AppName.Infrastructure \
        --output-dir Migrations

# Apply pending migrations to the ConnectionStrings:AppDb database — mind which one you point at.
migrate-update:
    dotnet ef database update \
        --project src/AppName.Infrastructure \
        --startup-project src/AppName.Infrastructure

# List migrations and which are applied (`--no-connect` to skip the database round-trip).
migrate-list:
    dotnet ef migrations list --project src/AppName.Infrastructure --startup-project src/AppName.Infrastructure
