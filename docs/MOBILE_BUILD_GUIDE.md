# 📱 Mobile Build Guide - Flow Finance

**Last Updated:** March 10, 2026  
**Version:** 0.4.1  
**Platforms:** Android & iOS

---

## 📋 Prerequisites

### Common (All Platforms)
- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Capacitor CLI: `npm install -g @capacitor/cli`
- ✅ Project dependencies: `npm install`

### Android
- **Java Development Kit (JDK) 17+**
  - Download: https://www.oracle.com/java/technologies/downloads/
  - Verify: `java -version`
  
- **Android Studio**: https://developer.android.com/studio
  - Install Android SDK (API 33+)
  - Install Android SDK Command-line Tools
  - Install Android SDK Build-Tools

- **Environment Variables (Windows)**:
  ```powershell
  # Add to System Environment Variables
  ANDROID_HOME=C:\Users\<USER>\AppData\Local\Android\Sdk
  Path=%ANDROID_HOME%\platform-tools
  Path=%ANDROID_HOME%\cmdline-tools\latest\bin
  ```

### iOS (macOS Only)
- **Xcode 14+**: https://developer.apple.com/xcode/
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Account** (for distribution)

---

## 🚀 Quick Start

### 1. Build Web App
```bash
npm run build
```

### 2. Initialize Mobile (First Time Only)
```bash
# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios

# Sync web build to native projects
npx cap sync
```

### 3. Open Projects

#### Android
```bash
npx cap open android
# Opens in Android Studio
```

#### iOS
```bash
npx cap open ios
# Opens in Xcode
```

---

## 🤖 Android Build Process

### Development Build (Debug)
```bash
# Full workflow
npm run build              # Build web app
npx cap sync android       # Sync to Android project
npx cap build android      # Build APK

# Or use shortcut
npm run build:android
```

### Release Build (Production)
```bash
# Generate release APK/AAB
npm run build:android:release

# Manually in Android Studio:
# 1. Build > Generate Signed Bundle/APK
# 2. Select APK or AAB
# 3. Choose keystore (create if first time)
# 4. Set key alias and passwords
# 5. Select "release" build variant
```

### Keystore Generation (First Time)
```bash
keytool -genkey -v -keystore flow-finance.keystore \
  -alias flow-finance -keyalg RSA -keysize 2048 -validity 10000

# Follow prompts to set passwords
# Store keystore in safe location
# Update android/app/build.gradle with signing config
```

---

## 🍎 iOS Build Process

### Development Build (Debug)
```bash
# Full workflow
npm run build              # Build web app
npx cap sync ios           # Sync to iOS project
npx cap open ios           # Open in Xcode

# In Xcode:
# 1. Select target device/simulator
# 2. Product > Run (Cmd+R)
```

### Release Build (TestFlight/App Store)
```bash
# Prepare release
npm run build:ios:release

# In Xcode:
# 1. Product > Archive
# 2. Window > Organizer
# 3. Select archive > Distribute App
# 4. Choose distribution method (TestFlight/App Store)
# 5. Follow wizard
```

---

## 🔧 Configuration Files

### capacitor.config.ts
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flowfinance.app',
  appName: 'Flow Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: true
    }
  }
};

export default config;
```

### android/app/build.gradle (Signing Config)
```gradle
android {
    signingConfigs {
        release {
            storeFile file("path/to/flow-finance.keystore")
            storePassword "YOUR_STORE_PASSWORD"
            keyAlias "flow-finance"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

---

## 📦 Build Outputs

### Android
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **Release AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

### iOS
- **Archive**: Created via Xcode Organizer
- **IPA**: Exported from archive for distribution

---

## 🧪 Testing on Devices

### Android
```bash
# Install via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or drag APK to running emulator
```

### iOS
```bash
# Deploy to connected device via Xcode
# Or use TestFlight for beta testing
```

---

## 🐛 Common Issues

### Android Studio Not Opening
- Verify `ANDROID_HOME` is set correctly
- Install Android SDK via SDK Manager
- Sync Gradle files in Android Studio

### Keystore Errors
- Ensure keystore path is correct
- Check passwords match
- Verify key alias exists

### iOS Build Fails
- Update CocoaPods: `pod repo update`
- Clean build folder: `Product > Clean Build Folder`
- Check provisioning profiles in Xcode

### Sync Errors
```bash
# Force clean sync
npx cap sync --force

# Remove and re-add platform
npx cap remove android
npx cap add android
```

---

## 📚 Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Docs**: https://developer.android.com/guide
- **iOS Docs**: https://developer.apple.com/documentation/
- **Play Console**: https://play.google.com/console
- **App Store Connect**: https://appstoreconnect.apple.com/

---

## ✅ Release Checklist

- [ ] Version bumped in `package.json`
- [ ] Web app built: `npm run build`
- [ ] Native projects synced: `npx cap sync`
- [ ] Android keystore configured
- [ ] iOS certificates/profiles configured
- [ ] Tested on real devices
- [ ] Screenshots prepared
- [ ] Store listings updated
- [ ] Release notes written
- [ ] Privacy policy updated
