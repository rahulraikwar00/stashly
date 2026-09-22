import { MyDarkTheme, MyLightTheme } from '@/constants/theme';
import '@/global.css';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect } from 'react';
import { useColorScheme } from 'nativewind';

import { ActivityIndicator } from 'react-native';

import migrations from '@/drizzle/migrations';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SQLiteProvider, openDatabaseSync } from 'expo-sqlite';

export const DATABASE_NAME = 'bookmarks';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme(); // ← destructure
  const theme = colorScheme === 'dark' ? MyDarkTheme : MyLightTheme;

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        options={{ enableChangeListener: true }}
        useSuspense>
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
              <Stack.Screen name="index" options={{ title: 'Home' }} />
            </Stack>
          </ThemeProvider>
        </Migrations>
      </SQLiteProvider>
    </Suspense>
  );
}

// ─────────────────────────────────────────────
// Run migrations before rendering children
// ─────────────────────────────────────────────

function Migrations({ children }: { children: React.ReactNode }) {
  const expoDb = openDatabaseSync(DATABASE_NAME);
  const db = drizzle(expoDb);
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
