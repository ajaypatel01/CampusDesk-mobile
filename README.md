# CampusDesk

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

## Building a shareable Android APK (no Expo account)

Staff install the app from an `.apk` file shared directly (WhatsApp, Drive, USB).
It's built and signed on a Mac with Java 17 and the Android SDK:

```bash
npx expo prebuild --platform android --clean --no-install   # regenerates android/ (gitignored)
git checkout package.json      # prebuild rewrites the android/ios scripts; keep the Expo Go ones
cd android && ./gradlew assembleRelease
# sign with the CampusDesk release key (kept outside the repo)
~/Library/Android/sdk/build-tools/36.0.0/apksigner sign \
  --ks ~/.campusdesk-keys/campusdesk-release.jks --ks-key-alias campusdesk \
  --ks-pass file:$HOME/.campusdesk-keys/keystore-password.txt \
  --out ~/Desktop/CampusDesk-<version>.apk app/build/outputs/apk/release/app-release.apk
```

- **Every APK must be signed with the same release key**, or installed copies refuse
  the update. Back up `~/.campusdesk-keys/` (keystore + password); losing it means
  everyone has to uninstall and reinstall.
- Bump `expo.version` and add/raise `expo.android.versionCode` in `app.json` for each
  new APK, or phones won't install it over the old one.
- There are no over-the-air updates in this setup: every change ships as a new APK.

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
