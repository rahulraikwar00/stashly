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

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme(); // ← destructure
  const theme = colorScheme === 'dark' ? MyDarkTheme : MyLightTheme;

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <Migrations>
        <ThemeProvider value={theme}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.card },
              headerTintColor: theme.colors.text,
              headerTitleStyle: { fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="add-bookmark" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </Migrations>
    </Suspense>
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
