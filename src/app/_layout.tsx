import { MyDarkTheme, MyLightTheme } from '@/constants/theme';
import '@/global.css';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect } from 'react';
import { useColorScheme } from 'nativewind';

import { ActivityIndicator } from 'react-native';

import migrations from '@/drizzle/migrations';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { ToastProvider } from '@/components/Feedback/ToastProvider';
import { ConfirmProvider } from '@/components/Feedback/ConfirmProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <Migrations>
        <SettingsProvider>
          <ThemedRoot />
        </SettingsProvider>
      </Migrations>
    </Suspense>
  );
}

function ThemedRoot() {
  const { colorScheme } = useColorScheme(); // nativewind (OS + in-app override)
  const { settings } = useSettings();

  const scheme = settings.theme !== 'system' ? settings.theme : colorScheme;
  const theme = scheme === 'dark' ? MyDarkTheme : MyLightTheme;

  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <ConfirmProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.card },
              headerTintColor: theme.colors.text,
              headerTitleStyle: { fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
          </Stack>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// ─────────────────────────────────────────────
// Run migrations before rendering children
// ─────────────────────────────────────────────

function Migrations({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success || error) {
      SplashScreen.hideAsync();
    }
  }, [success, error]);

  if (error) {
    console.error('Migration error:', error);
    return null;
  }

  if (!success) return null;

  return <>{children}</>;
}
