# ClarityForge AI

Android-first AI photo enhancement app. This repository is used to build an installable APK via GitHub Actions.

The Android client is built with Expo SDK 57 / React Native 0.86. Heavy enhancement tools use a configurable ClarityForge processing server.

## APK

Pushes to `main` trigger `.github/workflows/build-apk.yml`. When the workflow succeeds, download the `ClarityForge-APK` artifact from the workflow run and install `ClarityForge-debug.apk` on Android.
