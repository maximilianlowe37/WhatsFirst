# Native iOS App Blocking — Setup Guide

This guide walks you through enabling **real iOS Screen Time app blocking** inside "What's first?". When done, picking Instagram or TikTok while you have tasks due will show a Screen Time shield asking you to complete a task instead.

This is the only path that actually **prevents** opening an app. It requires:

1. Your paid Apple Developer account ($99/yr — you have this ✓)
2. Apple's approval of the **`com.apple.developer.family-controls` entitlement** for your app ID (1–5 business days, free, but mandatory — Apple reviews every request)
3. A **development iOS build** installed on a real iPhone (the Simulator does NOT support Family Controls)

The silent nag reminders (Path A) and the iOS Focus Filter (Path B) work today through the Replit QR code. This guide produces real blocking.

---

## What's already done in this repo

- `modules/expo-family-controls/` — the local Expo native module (Swift + JS API + podspec)
- `entitlements/FamilyControls.entitlements` — the entitlement plist file
- `utils/familyControls.ts` — JS-side helper with graceful fallbacks
- Settings UI: a new "Native app blocking" section card showing live status (with green/orange/grey dot)
- `BypassButton` automatically calls `unblockAll()` when a Free Pass is activated

The JS layer is fully wired and will Just Work once the native binary lands on the device. What you need to do is get that binary on your phone.

---

## Step 1 — Request the Family Controls entitlement (do this TODAY)

This is the longest step. While you wait for Apple to approve (1–5 days), do the rest.

1. Sign in to https://developer.apple.com/account
2. Go to **Certificates, Identifiers & Profiles → Identifiers**
3. Click your app ID (`com.whatsfirst.app` — register one if you haven't yet)
4. Scroll to **Capabilities** → tick **Family Controls** → Save
5. Go to **Profiles → +** → create a Development profile
   - Type: iOS App Development
   - App ID: `com.whatsfirst.app`
   - Include the **Family Controls** capability
   - Select your dev certificate + iPhone device
6. Download the profile → double-click to install in Xcode

### Apple's justification form

When you submit the entitlement, Apple asks for a written use-case justification. **Copy-paste this verbatim:**

> What's first? is a single-user productivity app that helps users complete prioritized tasks by temporarily restricting access to user-selected distracting apps during focus windows. We use Apple's FamilyControls framework to request authorization (with the system FamilyActivityPicker so the user explicitly picks each app) and ManagedSettings / ManagedSettingsStore to apply per-app shields while the user has active tasks due today.
>
> Users retain full control: they can disable surveillance at any time (subject to a configurable monthly cap), use a configurable monthly quota of Free Passes to temporarily lift all shields, and configure when reminders appear. The app never enumerates installed apps — it relies entirely on the system picker. The app does not collect or transmit any data about which apps the user blocks; selection state is stored locally in AsyncStorage.
>
> The shields are the user-requested, user-controlled enforcement mechanism for a single-user productivity flow (not a parental control or MDM scenario). We are not requesting child management or remote management capabilities — only `.individual` authorization.

---

## Step 2 — While you wait: prep the iOS build (10 minutes)

```bash
cd artifacts/whats-first
npx expo prebuild --platform ios --clean
cd ios
pod install
```

> `--clean` regenerates the iOS folder. If you have local iOS customizations (icons, Info.plist tweaks), back them up first.

Open the workspace:

```bash
open *.xcworkspace
```

## Step 3 — Wire the local native module into the Xcode project

The `modules/expo-family-controls/` directory is referenced by `package.json` as a `file:` dependency, but it still needs to be **embedded in the Xcode project**. Expo's autolinking handles this automatically when you run `pod install` — verify by:

1. In Xcode, click the project root in the navigator
2. Select the main app target → **Build Phases**
3. Expand **Link Binary With Libraries** — you should see `FamilyControls.framework` (or the local module pod)
4. If not: `npx expo run:ios --no-install` (this re-runs autolinking) or `cd ios && pod install`

## Step 4 — Add the entitlement to the Xcode project

1. In Xcode, select the main app target → **Signing & Capabilities**
2. Click **+ Capability** → search **Family Controls** → add it
3. Xcode creates `*.entitlements` automatically. Open that file and verify it contains:

```xml
<key>com.apple.developer.family-controls</key>
<true/>
```

4. If Xcode created a *different* entitlements file than `entitlements/FamilyControls.entitlements`, copy the contents from the repo file into Xcode's generated file. (Or delete Xcode's and point Build Settings → Code Signing Entitlements at `entitlements/FamilyControls.entitlements`.)

## Step 5 — Configure signing

1. **Signing & Capabilities → Team** → select your Apple Developer team
2. **Bundle Identifier** → `com.whatsfirst.app`
3. Make sure your iPhone is connected and selected as the run destination

## Step 6 — First build

```bash
cd artifacts/whats-first
npx expo run:ios --device "Your iPhone Name"
```

Or in Xcode: select your iPhone → **Product → Run** (`Cmd+R`).

The first build takes 3–5 minutes. Watch the console for `FamilyControls` module registration.

## Step 7 — First launch (on the iPhone)

1. Open "What's first?"
2. Go to **Settings → Native app blocking** (new section)
3. The status dot will be **orange** (permission not yet requested)
4. Tap **Set up app blocking** → the Apple system permission sheet appears
5. Tap **Allow** → the iOS Family Activity picker appears
6. Pick **Instagram, TikTok, YouTube** (or whatever you want blocked) → **Done**
7. The system shows a brief setup animation. After ~5 seconds, the status dot turns **green** with "Active — blocking N apps".

Try opening Instagram. You should see the **Screen Time shield** with the title/subtitle from `setupNativeBlocking()`.

---

## Step 8 — Test the Free Pass → unblock flow

1. Back in "What's first?", go to the **Tasks** tab
2. Tap the **unlock icon** in the top right (Free Pass button)
3. Confirm → toast says "Free Pass on — focus reminders paused for N min"
4. Try opening Instagram → **no shield** ✓
5. Wait `firstInterruptMinutes` minutes (default 15)
6. Try opening Instagram again → **shield is back** ✓

---

## Troubleshooting

**"Set up app blocking" button is greyed out**
- You're on the Replit QR / Expo Go build. Family Controls needs a development build.
- Build a dev build via `npx expo run:ios --device "..."` and install that to your phone.

**Apple permission sheet never appears**
- Confirm the entitlement is on (Step 4) and you have the latest provisioning profile (Step 1).
- In Xcode → Window → Devices and Simulators → your phone → Show Provisioning Profiles → make sure the latest one is installed.
- Restart your iPhone after installing the dev build — entitlement changes sometimes need a reboot to take effect.

**App picker appears but nothing happens after I tap Done**
- Check `expo-family-controls` module was linked: `cd ios && cat Podfile.lock | grep FamilyControls`. If absent, re-run `pod install` after ensuring `expo-family-controls` is in `node_modules/` (i.e. you ran `pnpm install`).

**Shields appear but the title is blank**
- The `ShieldConfiguration` extension isn't installed. The basic shield comes from `ManagedSettingsStore` directly. To customize title/subtitle, you need a separate **ShieldConfigurationExtension** target — see Apple's ["Customizing the shield UI" docs](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationextension) for the full setup. This is optional polish.

**Build fails with "FamilyControls.framework not found"**
- Ensure iOS deployment target is ≥ 15.0. In Xcode → main app target → **Build Settings → iOS Deployment Target → 15.0**.
- The picker (`FamilyActivityPicker`) requires iOS 16+. The module handles this — `isSupported()` returns false on older devices.

**"This app is not authorized to use Family Controls"**
- The entitlement wasn't approved yet, OR your provisioning profile doesn't include it.
- Regenerate the profile (Step 1.5) and reinstall on the device.

---

## What still works WITHOUT doing this guide

- ✅ Path A — silent focus nag notifications (today, through Replit QR)
- ✅ Path B — iOS Focus Filter (after the Xcode steps in FOCUS_FILTER_SETUP.md)
- ✅ All task / history / settings features

## What requires this guide

- 🔒 Real iOS Screen Time shields on Instagram / TikTok / YouTube / etc.

## When to do this

| Step | When |
|---|---|
| Step 1 — Submit entitlement | **Today** (5 minutes) |
| Step 2 — `expo prebuild` | After Step 1 (10 minutes) |
| Step 3-7 — Build, install, configure | **After Apple approves** (1–5 days after Step 1) |
| Step 8 — Test Free Pass | Right after Step 7 |

You can do Steps 2–6 immediately (without Apple approval) — the entitlement check happens at runtime, so the build will succeed but `requestAuthorization()` will fail at runtime until Apple approves.

---

## If you want to test without waiting for Apple

You **cannot**. Apple's entitlement check is enforced at runtime by the OS, not by us. There is no debug-mode override. Apple wants real accountability for this API.

Best fallback: use **Path A** (silent nag) and **Path B** (iOS Focus Filter) until approval arrives. Both work today through the Replit QR.