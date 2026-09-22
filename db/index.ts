// db/index.ts
// Re-export the single shared database instance so `@/db` and `@/db/client`
// resolve to the same opened connection.
export { db } from './client';
