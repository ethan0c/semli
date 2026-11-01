# Semli for iPhone

The Expo SDK 58 / React Native app for Semli. Today, Plan, School, Add, and You share the same planner data and design tokens. See the [root README](../../README.md) for product scope and connected services.

## Run locally

Install dependencies from the repository root using npm. Use Node.js 22.x (22.13+) or 24.x (24.3+), macOS, and the [SDK 58 toolchain](https://docs.expo.dev/versions/v58.0.0/) for local iOS builds.

From the repository root:

```bash
npm install
cp apps/mobile/.env.example apps/mobile/.env
npm run ios --workspace mobile
```

Start the website/API in a separate terminal with `npm run dev:web`, after configuring its environment. Set `EXPO_PUBLIC_API_URL` in the mobile environment to that server. The simulator can use `http://localhost:3000`; a physical iPhone needs your computer's LAN address. Debug builds also expose **You → Semli server** to change it.

For subsequent sessions, `npm run dev:mobile` starts Metro for the installed development client. Rebuild with `npm run ios --workspace mobile` after changes to native dependencies, plugins, splash configuration, or Swift modules: it regenerates `ios/` when the native fingerprint changed, which plain `npx expo run:ios` does not. Expo Go cannot run the complete app.

The iOS command uses macOS `lockf` to allow only one local build command per checkout, including native regeneration. If it reports `.expo/ios-build.lock: already locked`, stop the earlier `npm run ios` session first (it may still be serving Metro). The lock releases automatically when that command exits; leave the lock file in place. Builds started directly in Xcode or with `npx expo run:ios` bypass this guard: stop or finish those before running the npm command. If Xcode reports `build.db: database is locked`, stop the overlapping builds and retry a single build. The Sentry and Expo Dev Launcher script dependency warnings are separate from this error.

## Meme screenshot presets

In a development build, open **You → Your data → Meme screenshots** to switch between **Am I cooked?**, **Academic comeback tomorrow**, and **Told everyone I was busy**. These are temporary, read-only schedules in Today and Plan; they never enter your saved records, account sync, reminders, or alarms. Use **Show my saved plan** to leave the preview for this session.

For simulator captures, keep Metro running and use these commands from the repository root:

```bash
zsh design/load-meme.sh cooked
zsh design/load-meme.sh comeback          # Today is empty
zsh design/load-meme.sh comeback tomorrow # Plan shows tomorrow’s 23 deadlines
zsh design/load-meme.sh busy
zsh design/load-meme.sh off               # Restore the previous capture setup
```

The loader freezes the clock at 9:41 and backs up the previous development command and clock before changing them. It does not clear app storage. Scroll Today or Plan to capture the rest of a long list. In the comeback preview, **Show tomorrow’s 23 deadlines** in the same settings group opens its second screenshot.

## EAS development builds

Run these commands from `apps/mobile`. EAS requires an Expo account and access to this app's EAS project. Physical-device builds also need Apple signing and device provisioning.

```bash
# Physical iPhone
npx eas-cli@latest build --platform ios --profile development

# iOS simulator
npx eas-cli@latest build --platform ios --profile development-simulator
```

Install the resulting build, then start Metro from this directory:

```bash
npx expo start --dev-client
```

Cloud builds need their own EAS environment variables; follow the [environment guide](../../docs/env.md). The [App Store Connect guide](../../docs/app-store-connect.md#8-before-you-press-submit) covers signing and submission.

## Releasing

Commit first: the workflow runs on what you upload, so loose edits ship too. Then, from `apps/mobile`:

```bash
npx eas-cli@latest workflow:run .eas/workflows/release.yml -F message="What changed"
```

[release.yml](.eas/workflows/release.yml) runs typecheck, lint and the whole test suite, then compares the app's native fingerprint with existing production builds:

- **Only JS or images changed:** publishes an over-the-air update to the `production` channel. Phones pick it up in the background and run it on the next launch. Nothing goes through App Store review.
- **Native side changed** (a new native module, a config plugin, `app.json`, the Expo SDK): makes a new production build and sends it to App Store Connect. It lands in TestFlight; releasing it to the App Store is still done by hand in App Store Connect.

The runtime version comes from the fingerprint, so an update only reaches builds it can run on. A bad update can be rolled back with `npx eas-cli@latest update:rollback`. Watch runs at expo.dev under the project's Workflows tab.

## Configuration and source

The [.env.example](.env.example) lists the API URL, Supabase publishable keys, RevenueCat public SDK key, and optional PostHog/Sentry configuration. Accounts activate when Supabase is configured. Store offerings and the `semli_plus` entitlement must match RevenueCat; see the [offerings brief](../../docs/revenuecat-offerings-brief.md).

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens and layouts |
| `src/components/` | Shared interface components |
| `src/store/` | Planner state and local persistence |
| `src/lib/` | Imports, accounts, cloud backup, subscriptions, reminders, and other services |
| `src/native/` | Swift inline modules for AlarmKit ringing alarms |
| `app.json` / `eas.json` | Native configuration and cloud build profiles |

Full ringing alarms are a Plus feature requiring iOS 26+ and AlarmKit permission. Verify alarms, Apple sign-in, notifications, and purchases on a physical device before release. Android and a full browser app are not current release targets.

## Checks

From the repository root:

```bash
npm run lint --workspace mobile
npm run typecheck --workspace mobile
npm test
```

Open release work is tracked in the [launch checklist](../../docs/launch-checklist.md) and [developer checklist](../../docs/todo.md).
