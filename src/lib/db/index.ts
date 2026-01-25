/**
 * Database Client Setup
 * 
 * This module initializes the Drizzle ORM client for database operations.
 * 
 * Connection Strategy:
 * - Uses Neon serverless PostgreSQL for production
 * - Falls back to a mock/no-op client if DATABASE_URL is not configured
 * - Designed for serverless environments (Next.js Edge Runtime compatible)
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { env } from '@/lib/config/env';
import * as schema from './schema';

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get database client instance
 * 
 * Lazy initialization to avoid connection issues during build time.
 * Returns null if DATABASE_URL is not configured.
 */
export function getDb() {
  if (!env.DATABASE_URL) {
    console.warn('DATABASE_URL not configured. Workspace persistence is disabled.');
    return null;
  }

  if (!db) {
    const sql = neon(env.DATABASE_URL);
    db = drizzle(sql, { schema });
  }

  return db;
}

export { schema };

