# docker/android.Dockerfile
#
# Builds the AppName.Maui Android head WITHOUT installing the Android SDK,
# Java, or the MAUI workload on the host machine. Everything lives in this
# image; the repo is bind-mounted in at build/run time (see justfile recipes
# docker-android-image / docker-build-android / docker-shell).
#
# Usage (from repo root):
#   just docker-android-image     # build this image (slow the first time, several GB)
#   just docker-build-android     # build the Android head into the mounted repo
#   just docker-shell             # interactive shell with the SDK/workload available
#
# See docker/README.md for details and caveats (no emulator support here).

FROM mcr.microsoft.com/dotnet/sdk:10.0

# ---- OS packages -------------------------------------------------------------
# openjdk-17-jdk: required by the Android SDK build-tools / d8 / aapt2 toolchain.
# unzip/curl: needed to fetch and extract the Android cmdline-tools archive.
# Other bits (git, ca-certificates) are common build-time needs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openjdk-17-jdk \
        unzip \
        curl \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# ---- Node.js 24 (NodeSource) --------------------------------------------------
# Matches the Node version used in CI (.github/workflows/ci.yml) and is needed
# because AppName.Maui.csproj's BuildReactApp MSBuild target runs `npm install`
# + `npm run build` in ../web as part of a normal (non-SkipReactBuild) build.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Android SDK (command-line tools only; no Android Studio) ----------------
# NOTE: cmdline-tools version/build number changes periodically. The value
# below ("11076708", commandlinetools-linux package) was current as of late
# 2024/2025 cmdline-tools releases targeting compileSdk 35. If the download
# 404s, check https://developer.android.com/studio#command-line-tools-only
# for the latest "commandlinetools-linux-XXXXXXXX_latest.zip" build number
# and bump it here.
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=${ANDROID_HOME}
ARG ANDROID_CMDLINE_TOOLS_VERSION=11076708
ARG ANDROID_PLATFORM=android-35
ARG ANDROID_BUILD_TOOLS=35.0.0

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && curl -fsSL -o /tmp/cmdline-tools.zip \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" \
    && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
    && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

# Accept licenses, then install only what's needed to build net10.0-android
# (compileSdk 35, min API 21 per SupportedOSPlatformVersion in the csproj).
RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager \
        "platform-tools" \
        "platforms;${ANDROID_PLATFORM}" \
        "build-tools;${ANDROID_BUILD_TOOLS}"

# ---- .NET MAUI Android workload -----------------------------------------------
# This is the step that lets the container build the Android head without any
# host-side Android SDK install: the workload (incl. the Java/Android bindings)
# is installed straight into this image's dotnet install.
RUN dotnet workload install maui-android

WORKDIR /src
