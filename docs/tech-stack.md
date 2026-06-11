# Tech Stack

## Recommended Stack

- Android tablet app: Flutter
- Local offline data: SQLite
- Owner dashboard: React + Vite
- Authentication: Firebase Auth
- Cloud database: Firestore
- Hosting: Firebase Hosting
- Source control: GitHub

## Architecture

The tablet app remains usable without internet. It stores operational data locally first, then syncs to Firestore when internet is available.

The web dashboard is online-only. It manages setup data and reads synced reports from Firestore.

```text
Owner Web Dashboard -> Firebase Auth / Firestore
Staff Tablet App -> Local SQLite -> Firestore Sync
```

## Tooling Needed

- Node.js and npm
- Flutter SDK
- Android Studio / Android SDK
- Firebase CLI
- Git

## Current Workspace Status

- Git repo exists.
- Node.js/npm are installed.
- Flutter, Dart, and Firebase CLI still need setup.

