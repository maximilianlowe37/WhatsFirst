// expo-family-controls — public JS API.
//
// Usage from the app:
//
//   import {
//     isSupported,
//     requestAuthorization,
//     presentAppPicker,
//     shieldApps,
//     unblockAll,
//   } from 'expo-family-controls';
//
//   if (!(await isSupported())) return;  // Expo Go / Android / web
//   const status = await requestAuthorization();
//   if (status !== 'approved') return;
//   const tokens = await presentAppPicker();
//   await shieldApps(tokens, { title: 'Stay focused', subtitle: 'Complete a task to unblock.' });
//
// All functions throw `FamilyControlsUnavailableError` when the native
// module isn't installed, and `FamilyControlsAuthorizationError` when
// the user denies the Apple permission sheet.

import { Platform } from 'react-native';

import {
  AppToken,
  AuthorizationStatus,
  FamilyControlsAuthorizationError,
  FamilyControlsUnavailableError,
  ShieldConfig,
} from './FamilyControls.types';

type NativeFamilyControls = {
  getAuthorizationStatus: () => Promise<AuthorizationStatus>;
  requestAuthorization: () => Promise<AuthorizationStatus>;
  presentAppPicker: () => Promise<AppToken[]>;
  shieldApps: (tokens: AppToken[], config: ShieldConfig) => Promise<void>;
  unblockAll: () => Promise<void>;
  getBlockedApps: () => Promise<AppToken[]>;
  isSupported: () => Promise<boolean>;
};

/**
 * Internal: read the native module proxy or throw.
 * `requireNativeModule` is the modern Expo Modules way to access a
 * specific named native module from JS.
 */
async function getNative(): Promise<NativeFamilyControls> {
  try {
    // Defer the require so the import doesn't crash on web.
    const expoModulesCore = require('expo-modules-core') as {
      requireNativeModule<T>(name: string): T;
    };
    return expoModulesCore.requireNativeModule<NativeFamilyControls>('FamilyControls');
  } catch (err) {
    throw new FamilyControlsUnavailableError(
      `expo-family-controls native module not found. ` +
      `Run \`expo prebuild --platform ios\` and rebuild the app. ` +
      `Underlying error: ${(err as Error).message}`,
    );
  }
}

/** True only on a real iOS device with the entitlement and a dev build. */
export async function isSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const native = await getNative();
    return await native.isSupported();
  } catch {
    return false;
  }
}

/**
 * Query the current Family Controls authorization status.
 * Returns 'notDetermined' until the user has been prompted.
 */
export async function getAuthorizationStatus(): Promise<AuthorizationStatus> {
  if (Platform.OS !== 'ios') {
    throw new FamilyControlsUnavailableError('iOS only');
  }
  const native = await getNative();
  return native.getAuthorizationStatus();
}

/**
 * Show the Apple system permission sheet. Returns 'approved' if the user
 * granted, 'denied' if they refused.
 */
export async function requestAuthorization(): Promise<AuthorizationStatus> {
  if (Platform.OS !== 'ios') {
    throw new FamilyControlsUnavailableError('iOS only');
  }
  const native = await getNative();
  const status = await native.requestAuthorization();
  if (status !== 'approved') {
    throw new FamilyControlsAuthorizationError(`Authorization ${status}`);
  }
  return status;
}

/**
 * Show the system FamilyActivityPicker so the user can select apps and
 * web domains to block. Apple requires the user to pick them themselves
 * — we cannot enumerate installed apps for privacy reasons.
 */
export async function presentAppPicker(): Promise<AppToken[]> {
  if (Platform.OS !== 'ios') {
    throw new FamilyControlsUnavailableError('iOS only');
  }
  const native = await getNative();
  return native.presentAppPicker();
}

/**
 * Apply a ManagedSettings shield to the given apps. The shield appears
 * the next time the user tries to open one of them. Idempotent — calling
 * twice replaces the previous shield.
 */
export async function shieldApps(
  tokens: AppToken[],
  config: ShieldConfig,
): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new FamilyControlsUnavailableError('iOS only');
  }
  const native = await getNative();
  await native.shieldApps(tokens, config);
}

/** Remove all shields immediately. Used when the user activates a Free Pass. */
export async function unblockAll(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new FamilyControlsUnavailableError('iOS only');
  }
  const native = await getNative();
  await native.unblockAll();
}

/** Returns the currently-shielded apps, if any. */
export async function getBlockedApps(): Promise<AppToken[]> {
  if (Platform.OS !== 'ios') return [];
  try {
    const native = await getNative();
    return await native.getBlockedApps();
  } catch {
    return [];
  }
}

export {
  AppToken,
  AuthorizationStatus,
  FamilyControlsAuthorizationError,
  FamilyControlsUnavailableError,
  ShieldConfig,
};