import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';
import { DATABASE_NAME } from './database';

const expoDb = SQLite.openDatabaseSync(DATABASE_NAME);
export const db = drizzle(expoDb, { schema });
