# syntax=docker/dockerfile:1
#
# Container image for AppName.Api. Render has no native .NET runtime, so the API
# deploys as a Docker service; build it from the REPOSITORY ROOT, not from this
# directory, because the restore step needs global.json and the Directory.*.props
# files that live there:
#
#   docker build -f docker/api.Dockerfile -t appname-api .

# ---- Build -------------------------------------------------------------------

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# The project files are copied on their own first so that a source-only change
# reuses the cached (slow) restore layer instead of re-downloading every package.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/AppName.Domain/AppName.Domain.csproj src/AppName.Domain/
COPY src/AppName.Application/AppName.Application.csproj src/AppName.Application/
COPY src/AppName.Infrastructure/AppName.Infrastructure.csproj src/AppName.Infrastructure/
COPY src/AppName.Api/AppName.Api.csproj src/AppName.Api/
RUN dotnet restore src/AppName.Api/AppName.Api.csproj

# The MAUI head is deliberately absent: it needs the MAUI workload and platform
# SDKs, and the API does not reference it.
COPY src/AppName.Domain/ src/AppName.Domain/
COPY src/AppName.Application/ src/AppName.Application/
COPY src/AppName.Infrastructure/ src/AppName.Infrastructure/
COPY src/AppName.Api/ src/AppName.Api/
RUN dotnet publish src/AppName.Api/AppName.Api.csproj --configuration Release --no-restore --output /app

# ---- Runtime -----------------------------------------------------------------

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app ./

# The published output carries certs/yugabyte-ca.crt next to the binary, which is
# what a relative `Root Certificate=certs/yugabyte-ca.crt` in the connection
# string resolves against at runtime.

ENV ASPNETCORE_ENVIRONMENT=Production

# Render injects the port to bind in $PORT. ASPNETCORE_HTTP_PORTS is read at
# start-up and makes Kestrel listen on every interface in the container, which a
# hard-coded localhost URL would not. The variable has to expand at run time, so
# the command goes through a shell; `exec` keeps the app as PID 1 so it still
# receives the shutdown signal.
EXPOSE 10000
USER $APP_UID
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-10000} exec dotnet AppName.Api.dll"]
