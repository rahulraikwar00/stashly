// src/app/+native-intent.ts
// Intercepts system deep links (e.g. shares received via expo-sharing) and
// routes them to the Library home, where the AddBookmarkPopover auto-opens
// with the shared URL pre-filled.

const SHARE_HOST = 'expo-sharing';

export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): Promise<string | null> {
  try {
    if (new URL(path).hostname === SHARE_HOST) {
      return '/';
    }
    return path;
  } catch {
    return path;
  }
}
