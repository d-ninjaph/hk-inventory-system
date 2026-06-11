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
firebase deploy --only firestore
```

## Hosting

The dashboard build output is configured in `firebase.json`:

```text
apps/web-dashboard/dist
```

Deploy after Firebase CLI setup:

```powershell
npm run build
firebase deploy --only hosting
```

## Tablet App

Flutter is not installed yet in the current environment. Install Flutter and Android Studio first, then generate the tablet app under:

```text
apps/tablet-app
```
