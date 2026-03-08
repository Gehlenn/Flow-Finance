/**
 * CAPACITOR TYPE DEFINITIONS
 * Extends window global object with Capacitor types
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => 'android' | 'ios' | 'web';
      exit: () => void;
    };
  }
}

export {};
