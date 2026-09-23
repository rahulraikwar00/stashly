// hooks/useSettings.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import type { Settings } from '@/db/schema';
import { loadSettings, updateSettings, type SettingsPatch } from '@/db/settingsService';

type SettingsContextValue = {
  settings: Settings;
  update: (patch: SettingsPatch) => Promise<Settings>;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const { setColorScheme } = useColorScheme();

  // Load once on mount. Children are gated until settings exist so the theme
  // (and any other consumer) never renders with stale defaults.
  useEffect(() => {
    let cancelled = false;
    loadSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply the stored theme preference (system = follow the OS).
  useEffect(() => {
    if (!settings) return;
    setColorScheme(settings.theme as 'system' | 'light' | 'dark');
  }, [settings, setColorScheme]);

  const update = useCallback(async (patch: SettingsPatch) => {
    const updated = await updateSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  const reload = useCallback(async () => {
    setSettings(await loadSettings());
  }, []);

  const value = useMemo(() => {
    if (!settings) return null;
    return { settings, update, reload };
  }, [settings, update, reload]);

  if (!value) return null;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
