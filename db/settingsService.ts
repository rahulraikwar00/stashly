// db/settingsService.ts
import { eq } from 'drizzle-orm';
import { db } from './client';
import { settings, type Settings } from './schema';

export type SettingsPatch = Partial<
  Pick<
    Settings,
    | 'displayName'
    | 'username'
    | 'email'
    | 'avatarUri'
    | 'theme'
    | 'defaultStatus'
    | 'serverUrl'
    | 'apiKey'
  >
>;

const DEFAULTS = {
  displayName: '',
  username: '',
  email: '',
  avatarUri: '',
  theme: 'system',
  defaultStatus: 'all',
  serverUrl: '',
  apiKey: '',
} as const;

// Seeds serverUrl from EXPO_PUBLIC_METADATA_EXTRACTOR_URL as a default. The
// value is applied at row creation and (see loadSettings) backfilled whenever
// the stored field is empty — env acts as the default extractor, which the
// user can change and save over. In dev builds where env is always present,
// clearing the field + restarting re-asserts it; builds without env leave it
// user-controlled.
const ENV_SERVER_URL = process.env.EXPO_PUBLIC_METADATA_EXTRACTOR_URL?.trim().replace(/\/+$/, '');

export async function defaultSettings(): Promise<Settings> {
  return { id: 1, ...DEFAULTS, serverUrl: ENV_SERVER_URL ?? '', updatedAt: Date.now() };
}

/**
 * Loads the single settings row (id = 1). Creates it with defaults on first
 * use so callers never have to handle a missing row.
 */
export async function loadSettings(): Promise<Settings> {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (row) {
    // Backfill the extractor URL from env when the stored value is empty (e.g.
    // rows created before the env prefill existed). Only touches server_url so
    // the user's other saved data is never disturbed.
    if (!row.serverUrl.trim() && ENV_SERVER_URL) {
      const [updated] = await db
        .update(settings)
        .set({ serverUrl: ENV_SERVER_URL })
        .where(eq(settings.id, 1))
        .returning();
      return updated!;
    }
    return row;
  }

  const defaults = await defaultSettings();
  const [created] = await db.insert(settings).values(defaults).returning();
  return created;
}

/**
 * Partial update of the settings row. Always bumps updatedAt.
 * Returns the updated row.
 */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  await loadSettings(); // ensure the row exists before updating
  const [row] = await db
    .update(settings)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(settings.id, 1))
    .returning();
  return row!;
}

/**
 * Resets profile + preferences to their defaults (preserves server fields).
 */
export async function resetProfile(): Promise<Settings> {
  return updateSettings({
    displayName: '',
    username: '',
    email: '',
    avatarUri: '',
  });
}
