// utils/igDm.ts
// Client for the backend's DM relay (D-016) + one insert path shared with the
// paste flow. Talks to:
//   POST /auth/codes        register a pending 6-digit code
//   GET  /auth/status       is my code linked? (pending | linked | expired)
//   POST /auth/unlink       revoke my code + thread binding ("Forget")
//   GET  /messages/links    new forwarded reels, full bookmark shape (consumes)
//
// Auth on DM endpoints = the 6-digit link code as `X-API-Key: <code>` (or
// `Authorization: Bearer <code>`). The paid/DM path never touches a public
// link-preview API.

import { debugLog } from './debug';
import { resolveBackendConfig } from './backendConfig';
import { loadSettings } from '@/db/settingsService';
import { insertDmBookmarks } from '@/db/bookmarkService';
import type { IGBookmark, IGCodeStatus } from '@/types/ig';

/** Timeout for any single DM-relay request (mirrors the metadata client). */
export const DM_TIMEOUT_MS = 12000;

/**
 * The official Instagram account the user DMs `/link <code>` to.
 * Must match IG_USERNAME in backend/.env.
 */
export const IG_HANDLE = 'stashlyhq';

export type IGSyncErrorKind = 'network' | 'server' | 'conflict' | 'not-linked' | 'not-configured';

export class IGSyncError extends Error {
  kind: IGSyncErrorKind;

  constructor(kind: IGSyncErrorKind, message: string) {
    super(message);
    this.name = 'IGSyncError';
    this.kind = kind;
  }
}

async function fetchWithTimeout(
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DM_TIMEOUT_MS);
  try {
    return await fetch(input, {
      method: init?.method ?? 'GET',
      headers: init?.headers,
      body: init?.body,
      signal: controller.signal,
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `timeout after ${DM_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err);
    throw new IGSyncError('network', `Could not reach your server (${reason}).`);
  } finally {
    clearTimeout(timer);
  }
}

/** Fresh random 6-digit code. Channel token only — no security value on its own. */
function randomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += String(Math.floor(Math.random() * 10));
  return out;
}

export interface RegisterResult {
  code: string;
  expiresAt: number;
}

/**
 * Registers a freshly generated 6-digit code with the backend. Throws
 * IGSyncError('network') when unreachable, IGSyncError('conflict') when the
 * random code collides with an existing one (caller should retry).
 */
export async function generateAndRegisterCode(baseUrl: string): Promise<RegisterResult> {
  const code = randomCode();
  const res = await fetchWithTimeout(`${baseUrl}/auth/codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (res.status === 409) {
    throw new IGSyncError('conflict', 'Code collision — generate a new one.');
  }
  if (!res.ok) {
    throw new IGSyncError('server', `Registering the code failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { code?: string; expiresAt?: number };
  debugLog('igdm', 'code registered', data.code);
  return { code: data.code ?? code, expiresAt: data.expiresAt ?? 0 };
}

/**
 * Checks whether `code` is linked. Throws IGSyncError('network') when the
 * server is unreachable.
 *
 * @returns the status when the server knows the code; `null` when the code is
 *   unknown to the server (401) — i.e. expired or never registered.
 */
export async function getCodeStatus(baseUrl: string, code: string): Promise<IGCodeStatus | null> {
  const res = await fetchWithTimeout(`${baseUrl}/auth/status`, {
    headers: { 'X-API-Key': code },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new IGSyncError('server', `Code status failed (HTTP ${res.status}).`);
  }
  return (await res.json()) as IGCodeStatus;
}

/**
 * Fetches new DM bookmarks for the bound thread (consumes seen-state on the
 * backend). 401 → IGSyncError('not-linked') meaning the code isn't bound yet.
 */
export async function fetchNewLinks(baseUrl: string, code: string): Promise<IGBookmark[]> {
  const res = await fetchWithTimeout(`${baseUrl}/messages/links`, {
    headers: { 'X-API-Key': code },
  });
  if (res.status === 401) {
    throw new IGSyncError('not-linked', 'Your Instagram account is not linked yet.');
  }
  if (!res.ok) {
    throw new IGSyncError('server', `Syncing failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as IGBookmark[];
  debugLog('igdm', 'fetched links', data.length);
  return Array.isArray(data) ? data : [];
}

/**
 * Revokes `code` and its thread binding server-side (called by "Forget").
 * 404 → IGSyncError('not-linked') meaning the server doesn't know the code.
 */
export async function unlinkCode(baseUrl: string, code: string): Promise<void> {
  const res = await fetchWithTimeout(`${baseUrl}/auth/unlink`, {
    method: 'POST',
    headers: { 'X-API-Key': code },
  });
  if (res.status === 404) {
    throw new IGSyncError('not-linked', 'The server does not know this code.');
  }
  if (!res.ok) {
    throw new IGSyncError('server', `Revoking the code failed (HTTP ${res.status}).`);
  }
  debugLog('igdm', 'code unlinked', code);
}

export interface SyncResult {
  inserted: number;
  skipped: number;
}

// Module-level run lock so pull-to-refresh, the Profile button and (future)
// background tasks never overlap a sync with itself.
let syncLocked = false;

/**
 * THE sync: fetch new DMs from the backend and insert them as bookmarks
 * (dedup on urlHash). Returns null when another sync is already running.
 * Never falls through to a public preview API.
 */
export async function syncNow(baseUrl: string, code: string): Promise<SyncResult | null> {
  if (syncLocked) return null;
  syncLocked = true;
  try {
    const items = await fetchNewLinks(baseUrl, code);
    if (items.length === 0) return { inserted: 0, skipped: 0 };
    return await insertDmBookmarks(items);
  } finally {
    syncLocked = false;
  }
}

/**
 * Convenience: resolve the backend config (settings.serverUrl or the dev
 * hostUri fallback) and run a silent sync when a code is configured. Used by
 * pull-to-refresh. Returns the result, or null when not configured/unreachable
 * (errors are swallowed — this is a background nicety, never an alert).
 */
export async function syncNowIfLinked(): Promise<SyncResult | null> {
  const config = await resolveBackendConfig();
  if (!config) return null;

  const settings = await loadSettings();
  const code = settings.igCode.trim();
  if (!code) return null;

  try {
    const result = await syncNow(config.baseUrl, code);
    if (result && result.inserted > 0) {
      debugLog('igdm', 'silent sync inserted', result.inserted);
    }
    return result;
  } catch (err) {
    debugLog('igdm', 'silent sync failed', err instanceof Error ? err.message : String(err));
    return null;
  }
}
