// utils/profile.ts
// Client-side validation for profile/settings fields, plus the documented
// SERVER-SIDE verification rules a future self-hosted backend must enforce
// (re-validating every field server-side, never trusting the client).

import { File, Paths } from 'expo-file-system';

// ─────────────────────────────────────────────
// FUTURE SERVER-SIDE RULES (spec — no endpoint yet)
// ─────────────────────────────────────────────
// • All fields are re-validated server-side with the exact same rules below;
//   the server never trusts client-supplied data. Invalid input → 422 with a
//   structured error payload (field → message).
// • `displayName`: same + strip all HTML/tag content (`<`, `>` etc.).
// • `username`: same + global uniqueness, reserved-word list, Delphi-style
//   5/min rate limit per requester.
// • `email`: same + uniqueness + delivery verification (OTP/magic link) before
//   it is accepted; only ever over TLS.
// • `avatarUri`: server accepts an upload (≤ 2 MB, image/* mime sniffed) and
//   stores a reference; the client sends a storage ref, never an arbitrary URL.
// • `serverUrl`: TLS only; origin allowlist applied to any hook URLs stored.
// • `apiKey`: constant-time comparison; sent as `Authorization: Bearer` over
//   TLS; stored hashed (HMAC) server-side; supports rotation; per-key rate
//   limits and usage caps. NEVER logged.
// The Chrome extension consumes this same future endpoint with the same
// `serverUrl` + `apiKey` stored in these settings.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type DefaultStatusChoice = 'all' | 'favorites' | 'unread' | 'archived';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];
export const DEFAULT_STATUS_CHOICES: readonly DefaultStatusChoice[] = [
  'all',
  'favorites',
  'unread',
  'archived',
];

export type ProfileField =
  'displayName' | 'username' | 'email' | 'avatarUri' | 'serverUrl' | 'apiKey';

export type ProfileErrors = Partial<Record<ProfileField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const API_KEY_RE = /^[A-Za-z0-9._-]{8,128}$/;
const MAX_EMAIL = 254;
const MAX_DISPLAY_NAME = 50;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Display name is required.';
  if (trimmed.length > MAX_DISPLAY_NAME) return `Keep it under ${MAX_DISPLAY_NAME} characters.`;
  if (hasControlChars(trimmed)) return 'Display name contains invalid characters.';
  return null;
}

export function validateUsername(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional
  if (trimmed !== trimmed.toLowerCase()) return 'Username must be lowercase.';
  if (!USERNAME_RE.test(trimmed)) return 'Use 3–20 characters: letters, numbers, or underscores.';
  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional
  if (trimmed.length > MAX_EMAIL) return `Keep it under ${MAX_EMAIL} characters.`;
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

export function validateAvatarUri(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // '' = initials circle
  if (!/^(file:|content:|https:)/i.test(trimmed))
    return 'Avatar must be a local file, content URI, or https link.';
  return null;
}

export function validateServerUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional — fall back to env/hostUri resolution
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return 'Server URL must start with http:// or https://.';
  } catch {
    return 'Server URL must be a valid absolute URL.';
  }
  if (hasControlChars(trimmed)) return 'Server URL contains invalid characters.';
  return null;
}

export function validateApiKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional
  if (!API_KEY_RE.test(trimmed))
    return 'Use 8–128 characters: letters, numbers, dots, dashes, underscores.';
  return null;
}

/**
 * Copies a picked avatar into the app's document directory so it outlives the
 * picker cache (which the OS may purge). `content://` URIs are returned as-is.
 */
export async function persistAvatarUri(uri: string): Promise<string> {
  if (!/^file:\/\//i.test(uri)) return uri;
  try {
    const source = new File(uri);
    const dest = new File(Paths.document, `avatar-${Date.now()}${source.extension || '.jpg'}`);
    await source.copy(dest);
    return dest.uri;
  } catch {
    return uri; // best-effort: keep the picker URI
  }
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 && words[words.length - 1][0] ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function validateProfile(patch: Record<ProfileField, string>): ProfileErrors {
  const errors: ProfileErrors = {};
  const check = (field: ProfileField, result: string | null) => {
    if (result) errors[field] = result;
  };

  check('displayName', validateDisplayName(patch.displayName ?? ''));
  check('username', validateUsername(patch.username ?? ''));
  check('email', validateEmail(patch.email ?? ''));
  check('avatarUri', validateAvatarUri(patch.avatarUri ?? ''));
  check('serverUrl', validateServerUrl(patch.serverUrl ?? ''));
  check('apiKey', validateApiKey(patch.apiKey ?? ''));

  return errors;
}
