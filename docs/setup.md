# Local Setup

## Required Tools

- Node.js and npm
- Firebase CLI
- Git
- Flutter SDK and Android Studio / Android SDK are only needed later if packaging as a native Android app.

## Web Dashboard

```powershell
cd apps/web-dashboard
npm install
npm run dev
```

From the repository root, these scripts are also available:

```powershell
npm run dashboard:dev
npm run dashboard:build
npm run tablet:dev
npm run tablet:build
```

## Firebase

Create a Firebase project, then copy the web app config into:

```text
apps/web-dashboard/.env
```

Use `apps/web-dashboard/.env.example` as the template.

Current Firebase project:

```text
hk-inventory-system
```

Also enable these Firebase products:

- Authentication
- Firestore Database
- Hosting

Deploy Firestore rules and indexes after Firebase CLI setup:

```powershell
npm run firebase:login
npm run firebase:deploy:rules
```

If the Firebase login opens a browser, sign in with the Google account that owns the Firebase project.

## Hosting

The dashboard build output is configured in `firebase.json`:

```text
apps/web-dashboard/dist
```

Deploy after Firebase CLI setup:

```powershell
npm run firebase:login
npm run firebase:deploy:hosting
```

`firebase-tools` is installed as a project dev dependency, so a global Firebase CLI install is not required.

## Tablet App MVP

The current tablet MVP is a tablet-first React/Vite app for fast UI and sync testing:

```powershell
cd apps/tablet-app
npm install
npm run dev
```

Copy the same Firebase web config used by the dashboard into:

```text
apps/tablet-app/.env
```

Use `apps/tablet-app/.env.example` as the template.

Flutter and Android Studio are not installed yet in the current environment. Install them later if the MVP needs native Android packaging.
