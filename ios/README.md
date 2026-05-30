# Got Dirt? — iOS App

Native iOS wrapper for [gotdirt.us](https://www.gotdirt.us) built with SwiftUI + WKWebView.  
Supports iPhone and iPad, iOS 15 and later.

---

## Requirements

| Tool | Version |
|---|---|
| Xcode | 15 or later |
| iOS Deployment Target | 15.0+ |
| Apple ID | Free personal account works for device testing |
| macOS | Ventura 13+ recommended |

No paid Apple Developer account is required to test on your own devices.  
A paid account ($99/year) is only needed to distribute on the App Store.

---

## Opening the Project

1. Clone or pull the repository
2. Navigate to the `ios/` folder
3. Double-click **GotDirt.xcodeproj** — Xcode will open automatically

---

## Running on Your iPhone or iPad

### Step 1 — Set your signing team

1. In Xcode, click **GotDirt** in the project navigator (left sidebar)
2. Select the **GotDirt** target
3. Go to the **Signing & Capabilities** tab
4. Under **Team**, select your Apple ID from the dropdown
   - If your Apple ID is not listed: Xcode → Settings → Accounts → Add Account → sign in with your Apple ID
5. Xcode will automatically create a provisioning profile

### Step 2 — Trust the developer on your device (first time only)

1. On your iPhone or iPad go to **Settings → General → VPN & Device Management**
2. Find your Apple ID under "Developer App"
3. Tap it and tap **Trust**

### Step 3 — Connect and run

1. Connect your iPhone or iPad to your Mac with a USB cable
2. In Xcode, select your device from the device picker at the top of the window (it shows the device name next to the run button)
3. Press **Run** (⌘R) or click the play button
4. The app will install and launch on your device

---

## What the App Does

The app is a full-featured native shell for the Got Dirt? web platform. Everything that works on `www.gotdirt.us` works inside the app:

| Feature | Notes |
|---|---|
| Map view | Find dirt pits near your location |
| Haul order creation | Direct, broadcast, and self-haul modes |
| Stripe payments | Card entry and deposit authorization |
| Order management | View, confirm, complete orders |
| Buyer / driver / carrier dashboards | Full access to all role-specific views |
| Pull to refresh | Pull down anywhere to reload the current page |
| Swipe navigation | Swipe left from the edge to go back |
| Camera access | Granted automatically for Stripe card scanning |
| Location access | iOS prompts the user when the map requests location |
| Portrait + Landscape | Supported on both iPhone and iPad |

---

## Adding an App Icon

The project is configured to use a single 1024×1024 PNG icon (the modern approach — Xcode generates all required sizes automatically).

1. Create or export a 1024×1024 PNG of the Got Dirt? logo
2. In Xcode, open **Assets.xcassets → AppIcon**
3. Drag the PNG into the **1024pt** slot
4. Build and run — the icon will appear on the home screen

---

## Changing the Bundle ID

The default bundle identifier is `com.gotdirt.app`.  
If you get a signing conflict (another device already registered this ID), change it:

1. Click **GotDirt** in the project navigator
2. Select the **GotDirt** target → **Signing & Capabilities**
3. Change **Bundle Identifier** to something unique, e.g. `com.yourname.gotdirt`

---

## Building for TestFlight / App Store

A paid Apple Developer account is required for distribution.

1. In Xcode, select **Any iOS Device (arm64)** as the destination (not a physical device)
2. **Product → Archive**
3. In the Organizer window, click **Distribute App**
4. Follow the upload wizard to submit to TestFlight or the App Store

---

## Project Structure

```
ios/
├── GotDirt.xcodeproj/
│   └── project.pbxproj       ← Xcode project definition
└── GotDirt/
    ├── GotDirtApp.swift       ← App entry point (@main)
    ├── ContentView.swift      ← WKWebView + pull-to-refresh + permissions
    ├── Info.plist             ← Permissions, orientations, display name
    └── Assets.xcassets/
        ├── AppIcon.appiconset/   ← Drop your 1024×1024 PNG here
        └── AccentColor.colorset/ ← Amber/orange accent color
```

---

## Permissions Declared

The following usage descriptions are set in `Info.plist` so iOS can show the system permission prompt:

| Permission | Why |
|---|---|
| Location (When In Use) | Map feature — finding pits near the user |
| Camera | Stripe payment card scanning |
| Microphone | Required by iOS when camera access is granted |

---

## Troubleshooting

**"Untrusted Developer" on device**  
Go to Settings → General → VPN & Device Management → tap your Apple ID → Trust.

**"Failed to register bundle identifier"**  
The bundle ID `com.gotdirt.app` may already be taken. Change it to something unique in Signing & Capabilities.

**App shows blank white screen**  
The device needs an internet connection. The app loads `https://www.gotdirt.us` live — there is no offline mode.

**Can't find my device in the device picker**  
Make sure the device is unlocked, trust the Mac when prompted on the device screen, and try unplugging and replugging the cable.

**Xcode says "No account with"**  
Go to Xcode → Settings → Accounts and add your Apple ID.
