import { prisma } from "../prisma";

/**
 * Supabase's free plan pauses a project after about a week without queries.
 * One real query keeps it awake. Used by the daily Vercel cron (production)
 * and by scripts/keepalive.ts (run on a schedule for the dev database).
 */
export async function keepDatabaseAwake(client: { $queryRaw: typeof prisma.$queryRaw } = prisma) {
  const started = Date.now();
  await client.$queryRaw`SELECT 1`;
  return { ok: true, ms: Date.now() - started, at: new Date().toISOString() };
}
