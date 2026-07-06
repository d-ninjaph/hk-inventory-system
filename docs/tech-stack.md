# Tech Stack

## Recommended Stack

- Staff tablet MVP: React + Vite PWA/tablet web app
- Later native Android packaging option: Flutter
- Local offline data: SQLite
- Owner dashboard: React + Vite
- Authentication: Firebase Auth
- Cloud database: Firestore
- Hosting: Firebase Hosting
- Source control: GitHub

## Architecture

The tablet MVP remains usable during weak internet by saving orders locally first, then syncing to Firestore when internet is available.

The web dashboard is online-only. It manages setup data and reads synced reports from Firestore.

```text
Owner Web Dashboard -> Firebase Auth / Firestore
Staff Tablet MVP -> Local browser queue -> Firestore Sync
```

## Tooling Needed

- Node.js and npm
- Flutter SDK and Android Studio / Android SDK, only if moving to native Android packaging
- Firebase CLI
- Git

## Current Workspace Status

- Git repo exists.
- Node.js/npm are installed.
- Staff tablet MVP exists under `apps/tablet-app`.
- Flutter, Dart, and Android Studio are not installed yet on this device.
