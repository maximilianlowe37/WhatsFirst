// Shared TypeScript types for the expo-family-controls bridge.
//
// These mirror the Swift types in `ios/FamilyControlsModule.swift`.
// When the native module is not installed (Expo Go, Android, web),
// the JS layer returns `isSupported: false` and the rest of the API
// throws `FamilyControlsUnavailableError` to avoid confusing the UI.

export type AuthorizationStatus =
  | 'notDetermined'
  | 'denied'
  | 'approved';

/**
 * A single app that the user selected to be blocked. We never persist
 * the `displayName` for privacy — only the bundle identifier, which is
 * stable across app launches.
 */
export interface AppToken {
  bundleId: string;
  displayName: string;
}

export interface ShieldConfig {
  title: string;
  subtitle: string;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
}

export class FamilyControlsUnavailableError extends Error {
  constructor(message = 'expo-family-controls is not available on this platform or build') {
    super(message);
    this.name = 'FamilyControlsUnavailableError';
  }
}

export class FamilyControlsAuthorizationError extends Error {
  constructor(message = 'User denied Family Controls authorization') {
    super(message);
    this.name = 'FamilyControlsAuthorizationError';
  }
}