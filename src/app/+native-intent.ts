// src/app/+native-intent.ts
// Intercepts system deep links (e.g. shares received via expo-sharing) and
// routes them to the add-bookmark screen.

const SHARE_HOST = 'expo-sharing';

export async function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): Promise<string | null> {
  try {
    if (new URL(path).hostname === SHARE_HOST) {
      return '/add-bookmark';
    }
    return path;
  } catch {
    return path;
  }
}
