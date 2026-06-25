// Wrapper around expo-family-controls that swallows "module not available"
// errors so the UI degrades gracefully on Expo Go / Android / web.
//
// All exported functions return either:
//   - a successful result
//   - null (when the module isn't installed)
//   - an object describing what happened (e.g. { ok: false, reason: 'denied' })
//
// They never throw. Consumers can use them inside try/catch or simply
// check the returned shape.

import { Platform } from 'react-native';

import {
  AppToken,
  AuthorizationStatus,
  FamilyControlsAuthorizationError,
  FamilyControlsUnavailableError,
  ShieldConfig,
} from 'expo-family-controls';

export interface NativeBlockState {
  available: boolean;
  authorized: boolean;
  status: AuthorizationStatus;
  blockedCount: number;
  reason?: 'unavailable' | 'unsupported' | 'denied';
}

/**
 * Snapshot of the native blocking state. Used by Settings to show the
 * "Native blocking: …" status pill and to decide whether the "Set up
 * app blocking" button is interactive.
 */
export async function getNativeBlockState(): Promise<NativeBlockState> {
  if (Platform.OS !== 'ios') {
    return { available: false, authorized: false, status: 'notDetermined', blockedCount: 0, reason: 'unsupported' };
  }
  try {
    const mod = await import('expo-family-controls');
    const supported = await mod.isSupported();
    if (!supported) {
      return { available: false, authorized: false, status: 'notDetermined', blockedCount: 0, reason: 'unsupported' };
    }
    const status = await mod.getAuthorizationStatus();
    const blocked = await mod.getBlockedApps();
    return {
      available: true,
      authorized: status === 'approved',
      status,
      blockedCount: blocked.length,
      reason: status === 'denied' ? 'denied' : undefined,
    };
  } catch (err) {
    if (err instanceof FamilyControlsUnavailableError) {
      return { available: false, authorized: false, status: 'notDetermined', blockedCount: 0, reason: 'unavailable' };
    }
    return { available: false, authorized: false, status: 'notDetermined', blockedCount: 0, reason: 'unavailable' };
  }
}

/**
 * Run the full native setup flow: request permission, present the picker,
 * apply the shield. Returns the selected tokens on success, or null on
 * any failure (so the UI can show a hint instead of throwing).
 */
export async function setupNativeBlocking(config: ShieldConfig): Promise<AppToken[] | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const mod = await import('expo-family-controls');
    if (!(await mod.isSupported())) return null;
    await mod.requestAuthorization();
    const tokens = await mod.presentAppPicker();
    if (tokens.length === 0) return [];
    await mod.shieldApps(tokens, config);
    return tokens;
  } catch (err) {
    if (err instanceof FamilyControlsAuthorizationError) return null;
    if (err instanceof FamilyControlsUnavailableError) return null;
    return null;
  }
}

/**
 * Lift all shields immediately (used during a Free Pass). Safe to call
 * on platforms where the module isn't installed — it's a no-op there.
 */
export async function liftNativeBlocking(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const mod = await import('expo-family-controls');
    if (!(await mod.isSupported())) return;
    await mod.unblockAll();
  } catch {
    // Swallow — the rest of the app shouldn't crash if the entitlement
    // isn't approved or the module is missing.
  }
}

/**
 * Re-apply shields to the given tokens. Used when a Free Pass expires.
 */
export async function reapplyNativeBlocking(
  tokens: AppToken[],
  config: ShieldConfig,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (tokens.length === 0) return;
  try {
    const mod = await import('expo-family-controls');
    if (!(await mod.isSupported())) return;
    await mod.shieldApps(tokens, config);
  } catch {
    // Same swallow policy as liftNativeBlocking.
  }
}