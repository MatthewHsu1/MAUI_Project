# justfile — reusable dev commands for the MAUI + React solution.
# Install `just`: `cargo install just`, or grab a binary from https://github.com/casey/just/releases
# Run `just` (or `just --list`) to see all recipes.

set shell := ["bash", "-uc"]

# Host has memory pressure: dotnet must run single-proc with the MSBuild server/node-reuse off.
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

# Add a migration: `just migrate-add AddSomething`.
migrate-add name:
    dotnet ef migrations add {{name}} \
        --project src/AppName.Infrastructure \
        --startup-project src/AppName.Infrastructure \
        --output-dir Migrations

# Apply migrations to a local SQLite file (design-time; the app itself migrates on startup).
migrate-update:
    dotnet ef database update \
        --project src/AppName.Infrastructure \
        --startup-project src/AppName.Infrastructure

# List migrations.
migrate-list:
    dotnet ef migrations list --project src/AppName.Infrastructure --startup-project src/AppName.Infrastructure

# ---- Docker (Android) ---------------------------------------------------------
# Builds the Android head inside a container that carries the Android SDK +
# `maui-android` workload, so the host never needs the Android SDK/Java
# installed. The repo is bind-mounted in so build outputs (and the APK) land
# in the normal working tree. See docker/README.md for details/caveats.

# Build the docker image (slow first time; several GB). Re-run after editing docker/android.Dockerfile.
docker-android-image:
    docker build -t appname-maui-android -f docker/android.Dockerfile .

# Build the Android head inside the container; output lands in src/AppName.Maui/bin/Release/net10.0-android/.
docker-build-android:
    docker run --rm -v "$PWD":/src -w /src appname-maui-android dotnet build src/AppName.Maui/AppName.Maui.csproj -f net10.0-android -c Release

# Open an interactive shell in the container (SDK + Android tooling + workload available).
docker-shell:
    docker run --rm -it -v "$PWD":/src -w /src appname-maui-android bash

# ---- Housekeeping ------------------------------------------------------------

# Restore NuGet + npm dependencies.
restore:
    dotnet restore -m:1
    cd src/web && npm install

# Remove build outputs.
clean:
    dotnet clean -m:1
    rm -rf src/web/node_modules/.vite src/AppName.Maui/Resources/Raw/web
