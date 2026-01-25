/**
 * Drizzle ORM Configuration
 * 
 * This file configures Drizzle Kit for schema management and migrations.
 * 
 * Commands:
 * - npx drizzle-kit generate - Generate migration files from schema changes
 * - npx drizzle-kit migrate - Apply migrations to the database
 * - npx drizzle-kit studio - Launch Drizzle Studio for database management
 */

import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

