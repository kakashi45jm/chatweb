import { UserProfile } from '../types';

/**
 * Strips heavy data URLs (e.g. uploaded base64 videos or large photos) from the object
 * before persisting to browser localStorage, preventing QuotaExceededError.
 */
export function sanitizeUserForStorage(user: UserProfile): UserProfile {
  const sanitized = { ...user };
  
  // If coverUrl is a large base64 data URL (> 50KB), don't store in localStorage
  if (sanitized.coverUrl && sanitized.coverUrl.startsWith('data:') && sanitized.coverUrl.length > 50000) {
    sanitized.coverUrl = undefined;
  }
  
  // If avatarUrl is a large base64 data URL (> 50KB), don't store in localStorage
  if (sanitized.avatarUrl && sanitized.avatarUrl.startsWith('data:') && sanitized.avatarUrl.length > 50000) {
    sanitized.avatarUrl = undefined;
  }

  return sanitized;
}

/**
 * Safe wrapper for localStorage.setItem with automatic error recovery and quota handling.
 */
export function safeSetStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[Storage] Failed to save key "${key}":`, err?.message || err);

    // If quota exceeded, try cleaning old non-essential keys and retry
    try {
      if (key === 'livecall_auth_user') {
        const parsed = JSON.parse(value);
        const lightweight = sanitizeUserForStorage(parsed);
        // Also remove media entirely if quota is critical
        lightweight.coverUrl = undefined;
        lightweight.avatarUrl = undefined;
        localStorage.setItem(key, JSON.stringify(lightweight));
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  }
}

/**
 * Safe wrapper for localStorage.getItem
 */
export function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe wrapper for localStorage.removeItem
 */
export function safeRemoveStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}
