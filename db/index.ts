import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

const expoDb = SQLite.openDatabaseSync("bookmarks.db");
// @ts-expect-error
export const db = drizzle(expoDb, { schema });
