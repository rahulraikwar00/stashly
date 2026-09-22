// db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema'; // Your schema file
import { DATABASE_NAME } from './database';

// Open the database synchronously for Expo
const expoDb = SQLite.openDatabaseSync(DATABASE_NAME);

// Export the Drizzle instance with your schema
export const db = drizzle(expoDb, { schema });
