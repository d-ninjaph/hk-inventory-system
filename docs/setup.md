# Local Setup

## Required Tools

- Node.js and npm
- Flutter SDK
- Android Studio / Android SDK
- Firebase CLI
- Git

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

## Tablet App

Flutter is not installed yet in the current environment. Install Flutter and Android Studio first, then generate the tablet app under:

```text
apps/tablet-app
```
