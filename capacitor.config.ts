import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration — Flow Finance
 *
 * PART 9 — Preparação para build mobile (Android + iOS)
 *
 * Para usar:
 *   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
 *   npx cap add android
 *   npx cap add ios
 *   npm run build && npx cap sync
 *   npx cap open android   # abre no Android Studio
 *   npx cap open ios       # abre no Xcode
 */
const config: CapacitorConfig = {
  appId: 'com.flowfinance.app',
  appName: 'Flow Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false, // Enable HTTPS only in production
    // Em desenvolvimento: descomente para apontar para servidor local
    // url: 'http://192.168.1.100:3000',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#6366f1',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
      sound: 'beep.wav',
    },
    PushNotifications: {
      presentationOption: ['badge', 'sound', 'alert'],
    },
  },
  // ─── iOS Info.plist Keys ───────────────────────────────────────────────────
  // These need to be added to Info.plist manually or via native project:
  // - NSCameraUsageDescription (for receipt scanner)
  // - NSMicrophoneUsageDescription (for voice input)
  // - NSLocationWhenInUseUsageDescription (for bank sync with location)
};

export default config;
