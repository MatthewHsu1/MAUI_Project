# Docker Android build

Build the `AppName.Maui` Android head without installing the Android SDK, Java,
or the MAUI workload on your host machine. Everything needed lives in
`docker/android.Dockerfile`; the repo is bind-mounted into the container so
NuGet restores and build outputs land directly in your working tree.

## Quick start

```bash
# 1. Build the image (slow the first time: downloads the .NET SDK base image,
#    JDK, Node.js, and the Android cmdline-tools + platform/build-tools, then
#    runs `dotnet workload install maui-android`).
just docker-android-image

# 2. Build the Android head.
just docker-build-android

# 3. Or just get a shell with the SDK/workload available.
just docker-shell
```

These map to plain `docker build` / `docker run` commands — see the
`# ---- Docker (Android) ----` section of the root `justfile` for the exact
commands if you want to run them without `just`.

## Where the APK lands

```
src/AppName.Maui/bin/Release/net10.0-android/
```

(Because the repo is bind-mounted at `/src` inside the container, this is the
same path on your host once the build finishes.)

## Caveats

- **Image size**: the image is several GB (dotnet SDK + JDK + Android SDK
  components + Node.js). The first `docker-android-image` build will take a
  while and use real disk space.
- **No emulator support**: this image does not set up an Android emulator.
  Running one inside Docker needs `--device /dev/kvm` (hardware
  virtualization passthrough) plus an AVD/system-image setup that isn't
  included here. The supported workflow is to build the APK in the container
  and deploy it to a **physical device** via `adb install` (or `adb` over
  USB/network from the host, since `adb` itself isn't bundled in this image),
  or to use `just docker-shell` to poke around interactively.
- **Android only**: this image and devcontainer cover the Android head only.
  iOS, Mac Catalyst, and Windows heads need their native OS toolchains and are
  not buildable in this Linux container — see the CI matrix
  (`.github/workflows/ci.yml`) for how those are/aren't covered.
- **Versions may drift**: the Android cmdline-tools build number and
  platform/build-tools versions pinned in `android.Dockerfile` will go stale
  over time. See the comments at the top of the `ENV ANDROID_HOME=...` block
  in the Dockerfile for how to find current values.
