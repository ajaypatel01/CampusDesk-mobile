# CampusDesk Parent

A React Native (Expo) mobile app for CampusDesk parents — sign in and check your child's
class homework and exam results from a phone. This is the mobile counterpart to the
"My Ward" section of the [CampusDesk](https://github.com/ajaypatel01/CampusDesk) web app,
talking to the same backend API.

**Scope, deliberately:** this app is parent-only. Staff/admin features stay on the web app.

## Stack

- [Expo](https://expo.dev) SDK 57 + React Native, TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
  (`src/app/`), with [`Stack.Protected`](https://docs.expo.dev/router/advanced/authentication/)
  gating the app behind login
- `expo-secure-store` for the JWT (never `AsyncStorage`/plain storage — it's an auth token)
- No state-management library — the API surface here is small enough that plain
  `useState`/`useEffect` in screen components is the right amount of complexity

## Project structure

```
src/
  api/client.ts        API base URL, fetch wrapper, typed endpoint functions
  auth/AuthContext.tsx Login/logout, JWT decode, current user
  screens/              Actual screen implementations (non-route code)
    LoginScreen.tsx
    MyWardScreen.tsx
  app/                  Expo Router routes — thin files that render the screens above
    _layout.tsx         Root layout: auth gate (Stack.Protected)
    login.tsx
    index.tsx           "My Ward" — the only screen once logged in
```

## Backend

Points at the same CampusDesk instance the web app uses:
`https://13-202-93-187.sslip.io/api/v1` (see `src/api/client.ts` — change `BASE_URL` there
if you need to point at a different environment).

The endpoints this app uses (`/auth/login`, `/my-wards`, `/ward-homework`, `/ward-exams`,
`/marksheets`) are scoped server-side to the logged-in parent's own ward(s) — see the
backend's `feature/parent-ward-access` work for details.

## Getting started

Requires **Node 20+** (Expo SDK 57's CLI tooling doesn't run on Node 18).

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (iOS/Android) to run it on your own phone, or
press `a` / `i` in the terminal for an Android/iOS emulator. Note: this app currently only
uses Expo-Go-compatible native modules, so Expo Go works fine for development — no
custom dev client needed yet.

Useful commands (see `AGENTS.md` for the full list this project was scaffolded to follow):

```bash
npx expo lint       # lint
npx tsc --noEmit    # typecheck
npx expo-doctor     # dependency/config sanity check
```

## Shipping to the App Store / Play Store

This project doesn't have local `ios/`/`android/` folders (Expo's Continuous Native
Generation) — builds happen via [EAS](https://docs.expo.dev/eas/index/):

```bash
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
npx eas-cli@latest submit
```

You'll need an Expo account and, for iOS, an Apple Developer account. EAS handles
signing/provisioning for you — no local Xcode/Android Studio required.
