// db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema'; // Your schema file

// Open the database synchronously for Expo
const expoDb = SQLite.openDatabaseSync('bookmarks.db');

// Export the Drizzle instance with your schema
export const db = drizzle(expoDb, { schema });
