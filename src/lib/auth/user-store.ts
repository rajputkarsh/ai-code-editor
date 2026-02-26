import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';

interface UpsertUserInput {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export async function upsertAppUser(input: UpsertUserInput): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date();
  await db
    .insert(schema.appUsers)
    .values({
      userId: input.userId,
      email: input.email ?? null,
      fullName: input.fullName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.appUsers.userId,
      set: {
        email: input.email ?? null,
        fullName: input.fullName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: now,
      },
    });
}

export async function getAppUser(userId: string) {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(schema.appUsers)
    .where(eq(schema.appUsers.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}
