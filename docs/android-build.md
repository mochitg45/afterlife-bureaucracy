# Android build

- `npm run cap:sync` builds the web app and copies it into `android/`.
- `npm run cap:open` opens the project in Android Studio.
- Debug APK from the command line: `cd android && gradlew.bat assembleDebug`.
- Target SDK 36 is set in `android/variables.gradle`. Google Play rejects lower targets.
- Portrait orientation is locked in `AndroidManifest.xml`.
- Saves live in Capacitor Preferences under key `afterlife.save.v1`.
