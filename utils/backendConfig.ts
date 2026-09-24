// utils/backendConfig.ts
// The single place that resolves which backend the app talks to, resolved at
// call time (D-013), never baked into a build:
//   1. settings.serverUrl (profile, user-controlled; prefilled from env on
//      first run) — with settings.apiKey as the bearer token;
//   2. http://<dev-machine-ip>:8000 derived from Expo's hostUri (local dev);
//   3. null → callers decide how to degrade.

import Constants from 'expo-constants';
import { loadSettings } from '@/db/settingsService';

export interface BackendConfig {
  baseUrl: string;
  apiKey: string;
}

export async function resolveBackendConfig(): Promise<BackendConfig | null> {
  try {
    const settings = await loadSettings();
    const baseUrl = settings.serverUrl.trim().replace(/\/+$/, '');
    if (baseUrl) return { baseUrl, apiKey: settings.apiKey.trim() };
  } catch {
    // fall through to the dev fallback below
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return { baseUrl: `http://${host}:8000`, apiKey: '' };
  }

  return null;
}

export type ServerStatus = 'unset' | 'checking' | 'online' | 'offline';

/**
 * Pings the configured backend's open `/health` endpoint. On-demand only —
 * callers trigger it (profile open, manual check); it never polls. Never
 * throws; returns 'unset' when no backend is configured.
 */
export async function checkServerHealth(): Promise<ServerStatus> {
  const config = await resolveBackendConfig();
  if (!config) return 'unset';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${config.baseUrl}/health`, { signal: controller.signal });
    return res.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}
