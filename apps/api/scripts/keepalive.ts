/**
 * Keeps the database project awake: one query against whatever DATABASE_URL in
 * apps/api/.env points at. Run it on a schedule (see README note in the script
 * header) so the free Supabase project does not pause after a quiet week.
 *
 *   npm run keepalive            (from apps/api)
 *
 * Windows Task Scheduler, once a day (run this in a terminal):
 *   schtasks /Create /SC DAILY /ST 09:00 /TN "hybrid-lms-keepalive" ^
 *     /TR "cmd /c cd /d C:\Users\cchey\projects\hybrid-lms\apps\api && npm run keepalive"
 */
import { keepDatabaseAwake } from "../src/services/keepalive";
import { prisma } from "../src/prisma";

keepDatabaseAwake()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((err: Error) => {
    console.error("keepalive failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
