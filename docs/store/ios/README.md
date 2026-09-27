# App Store assets

- `app-store-icon-1024.png`: the App Store Connect icon (1024x1024, RGB, no transparency, square
  corners; Apple rounds it). Same art as Android: `docs/art/icon-v2/icon.jpg`.
- In-app iOS icons: once the `ios/` project exists (`npx cap add ios`), run
  `node node_modules/@capacitor/assets/bin/capacitor-assets generate --ios`; it builds every
  size from `assets/icon.png`, the same source as Android.
- Screenshots: `npm run screenshots` writes the iPhone 6.9-inch set to
  `docs/store/screenshots/ios-6.9/` and the iPad 13-inch set to `docs/store/screenshots/ios-ipad-13/`.
- App Store has no feature graphic; the Play one is `docs/store/play-games/feature-1024x500.png`.
