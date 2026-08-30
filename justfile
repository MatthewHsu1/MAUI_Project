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

# ---- Dev servers -------------------------------------------------------------

# PID and log files for `just dev`. Git-ignored; nothing else reads it.
run_dir := ".just-dev"

# Where the API listens. src/web/.env.development points VITE_API_BASE_URL at
# this exact URL, and the API's Cors:Origins allows Vite's own :5173 back.
# Passed explicitly because the API project has no launchSettings.json to
# default from.
api_url := "http://localhost:5000"

# Start the API and Vite in the background (stop: `just dev-stop`, output: `just dev-logs`).
dev: dev-stop
    #!/usr/bin/env bash
    set -euo pipefail

    mkdir -p "{{run_dir}}"

    # Each server is started under `setsid`, in its own process group, and
    # records its OWN pid rather than the one the shell hands back.
    #
    # Both wrappers fork the thing that actually holds the port -- `dotnet run`
    # execs the built binary, `npm run dev` spawns vite -- so killing the pid
    # `$!` gives us would reap the wrapper and leave the server behind, still
    # holding :5000 or :5173. Writing `$$` from inside the new session records
    # the group leader instead, and `exec` keeps that same pid for the server.
    # `dev-stop` then signals the whole group.
    # ASPNETCORE_ENVIRONMENT is set by hand because the API project has no
    # launchSettings.json to carry it, and `dotnet run` then defaults to
    # Production. That default is not cosmetic: WebApplication.CreateBuilder
    # loads user-secrets ONLY in Development, so a Production run cannot see
    # ConnectionStrings:AppDb and dies in AddInfrastructure before it listens.
    # appsettings.Development.json -- the dev JWT key, and the Cors:Origins
    # entry for Vite's :5173 -- is skipped for the same reason.
    setsid bash -c "echo \$\$ > '{{run_dir}}/api.pid'; ASPNETCORE_ENVIRONMENT=Development exec dotnet run --project src/AppName.Api --urls '{{api_url}}'" \
        > "{{run_dir}}/api.log" 2>&1 &

    setsid bash -c "echo \$\$ > '{{run_dir}}/web.pid'; exec npm --prefix src/web run dev" \
        > "{{run_dir}}/web.log" 2>&1 &

    echo "api  {{api_url}}       -> {{run_dir}}/api.log"
    echo "web  http://localhost:5173 -> {{run_dir}}/web.log"
    echo
    echo "just dev-logs   follow both"
    echo "just dev-stop   stop both"

# Stop whatever `just dev` started. Safe to run when nothing is up.
dev-stop:
    #!/usr/bin/env bash
    # No `-e`: a stale pid file whose process is already gone is the normal
    # case, not a failure.
    set -uo pipefail

    for name in api web; do
        pid_file="{{run_dir}}/${name}.pid"

        [[ -f "$pid_file" ]] || continue

        pid="$(cat "$pid_file")"

        # A NEGATIVE pid signals the whole process group -- see the note in
        # `dev` for why the group and not the single process.
        if [[ -n "$pid" ]] && kill -TERM -- "-${pid}" 2>/dev/null; then
            echo "stopped ${name}"
        fi

        rm -f "$pid_file"
    done

# Follow both dev-server logs. Ctrl+C stops following; the servers keep running.
dev-logs:
    #!/usr/bin/env bash
    set -euo pipefail

    # -F rather than -f so a log that has not been created yet is waited for
    # instead of aborting the whole tail.
    tail -n 40 -F "{{run_dir}}/api.log" "{{run_dir}}/web.log"

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
