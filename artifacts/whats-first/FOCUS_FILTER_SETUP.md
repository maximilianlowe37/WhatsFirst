# iOS Focus Filter — Setup Guide

This guide walks you through adding "What's first?" as a system-wide iOS Focus Filter, so your top task shows up on the Lock Screen and in the Dynamic Island whenever you enable it inside a Focus mode.

**No Apple entitlement required.** iOS 16+ public APIs only. Works alongside the silent focus nag (Path A) and lays the groundwork for the Family Controls module (Path C).

---

## What this gives you

When enabled in `Settings > Focus > [any Focus] > Add Filter > What's first?`, your app surfaces its current top task in:
- **Lock Screen** — large card on every wake
- **Dynamic Island** — persistent live activity on iPhone 14 Pro+
- **Control Center** — when Focus is on

## What this guide produces

1. A new Xcode target: **Intents Extension** (Swift) bundled inside the main app
2. An `Intents.intentdefinition` declaring a `FocusFilterIntent`
3. An **App Group** (`group.com.whatsfirst.app`) shared between the main app and the extension
4. Bridge code that reads the JSON payload `utils/focusFilter.ts` writes from AsyncStorage

---

## Prerequisites

- macOS with Xcode 15+
- iOS 16+ device (the Simulator can build the extension but won't render the filter UI)
- Your paid Apple Developer account (already enrolled — $99/yr)
- App bundle ID: `com.whatsfirst.app`
- This project already running through Expo (`pnpm install` etc.)

---

## Step 1 — Run `expo prebuild` to materialize the `ios/` folder

```bash
cd artifacts/whats-first
npx expo prebuild --platform ios --clean
```

> **Note:** `--clean` regenerates the iOS folder from scratch. If you have local iOS customizations, back them up first.

## Step 2 — Open the generated workspace in Xcode

```bash
open ios/*.xcworkspace
```

## Step 3 — Create the Intents Extension target

1. In Xcode, `File > New > Target…`
2. Choose **Intents Extension** (in the iOS tab, Application Extension section)
3. **Product Name:** `FocusFilterExtension`
4. **Language:** Swift
5. **Embed In Application:** `First-Finder` (or whatever your main app target is named — should match `name` in `app.json`)
6. **Activate** the new scheme when prompted → Finish
7. When the activation sheet appears, **cancel** — we'll build manually.

## Step 4 — Configure the extension's bundle ID

1. In the project navigator, select the **FocusFilterExtension** target
2. **Signing & Capabilities** tab
3. Set **Bundle Identifier** to `com.whatsfirst.app.focusfilter`
4. Set **Team** to your Apple Developer team

## Step 5 — Add App Group capability (both targets)

App Groups are how the main app and the extension share data — without this, the extension cannot read your top task.

For the **main app target** (`First-Finder`):
1. **Signing & Capabilities → + Capability → App Groups**
2. Add: `group.com.whatsfirst.app`
3. Check the box next to it

For the **FocusFilterExtension** target:
1. Same: **Signing & Capabilities → + Capability → App Groups**
2. Add: `group.com.whatsfirst.app`
3. Check the box next to it

## Step 6 — Define the FocusFilterIntent

1. In the project navigator, right-click the **FocusFilterExtension** folder → `New File…`
2. Choose **iOS → Resource → Intent Definition File**, name it `Intents.intentdefinition`
3. In the file, click **+** to add a new Intent
4. Set:
   - **Intent Name:** `FocusFilter`
   - **Title:** `What's first? Focus Filter`
   - **Description:** `Shows your top task during a Focus session.`
   - **Category:** Information
5. Add a **Parameter** of type `String` named `displayText` (the extension will receive this as the rendered text)
6. Save and close

In Xcode, you also need to register this intent:
1. Select **FocusFilterExtension** target → **Build Settings**
2. Search for `Intent` → find `INTENTS_CODEGEN_LANGUAGE` and set to `Swift`
3. Build the project once (`Cmd+B`) — Xcode generates `IntentClasses.swift`

## Step 7 — Implement the extension's intent handler

Replace the contents of `FocusFilterExtension/IntentHandler.swift` (created by the template) with:

```swift
import Intents
import os

class IntentHandler: INExtension, FocusFilterIntentHandling {

    func handle(intent: FocusFilterIntent, completion: @escaping (FocusFilterIntentResponse) -> Void) {
        let display = readTopTaskFromAppGroup() ?? "Open What's first?"
        let response = FocusFilterIntentResponse(code: .success, userActivity: nil)
        response.displayText = display
        completion(response)
    }

    private func readTopTaskFromAppGroup() -> String? {
        guard let defaults = UserDefaults(suiteName: "group.com.whatsfirst.app"),
              let json = defaults.string(forKey: "wf_focus_filter_payload"),
              let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        guard let top = obj["topTask"] as? [String: Any],
              let title = top["title"] as? String else { return nil }
        let due = obj["dueTodayCount"] as? Int ?? 0
        return "📋 \(title)  (\(due) due today)"
    }
}
```

> The JSON key `wf_focus_filter_payload` matches the AsyncStorage key our app writes. After the extension is installed, copy that value from AsyncStorage into the App Group UserDefaults on every app launch — see Step 8.

## Step 8 — Mirror AsyncStorage → App Group on app launch

Because AsyncStorage is sandboxed per-target, we need a tiny native bridge in the main app that copies the latest payload into the shared App Group each time the app comes to the foreground.

The cleanest way without ejecting from Expo is to add a small native module that reads AsyncStorage and writes to UserDefaults. Alternatively, you can use a **config plugin** (preferred):

Create `plugins/withAppGroupSync.js` at the repo root and add it to your `app.json`:

```js
// plugins/withAppGroupSync.js
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withAppGroupSync(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSUserActivityTypes = cfg.modResults.NSUserActivityTypes || [];
    return cfg;
  });
};
```

For a quick manual approach (recommended for now), add this to the **main app target** AppDelegate.m (right before the existing `return YES;` in `applicationDidBecomeActive:`):

```objc
- (void)mirrorPayloadToAppGroup {
    NSUserDefaults *group = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.whatsfirst.app"];
    NSString *json = [[NSUserDefaults standardUserDefaults] stringForKey:@"wf_focus_filter_payload"];
    if (json) [group setObject:json forKey:@"wf_focus_filter_payload"];
}
```

Call it from `applicationDidBecomeActive:`.

## Step 9 — Build and run to a real device

1. Plug in an iPhone running iOS 16+
2. Select the device in Xcode's scheme picker
3. **Product → Run** (`Cmd+R`)
4. First run installs both the main app and the extension

## Step 10 — Enable the filter

On your iPhone:
1. **Settings → Focus → choose any Focus (or create one)**
2. Scroll down → **Add Filter**
3. Tap **What's first?**
4. Configure which Focus states show it (Lock Screen, Home Screen, etc.)

You should now see your top task on the Lock Screen during that Focus.

---

## Troubleshooting

**"What's first?" doesn't appear in the filter list**
- Make sure the extension's bundle ID is `com.whatsfirst.app.focusfilter`
- Restart Settings.app after building
- Check the extension target is embedded: main app target → **Build Phases → Embed App Extensions** should list `FocusFilterExtension.appex`

**Filter shows the wrong task**
- The App Group mirror in Step 8 only runs on foreground. Open the app at least once after adding/updating tasks.
- Verify the App Group name exactly matches in **both** targets AND in the Swift code (`group.com.whatsfirst.app` — case-sensitive)

**Filter shows nothing**
- Open the main app once after launch. The extension can't trigger an AsyncStorage read on its own.
- Open Console.app on macOS → filter for your extension's bundle ID to see runtime errors.

---

## What this guide does NOT do

- Does **not** actually block any apps. That's Path C (Family Controls) — see `FAMILY_CONTROLS_SETUP.md`.
- Does **not** work in the iOS Simulator (only physical devices).
- Does **not** survive an `expo prebuild --clean` without redoing Steps 3–8. Either commit the `ios/` folder to git, or use Expo config plugins to automate the target creation.