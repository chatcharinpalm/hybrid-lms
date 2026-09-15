// Plain string-union "enums" instead of Prisma enums.
//
// The database runs on SQLite for local dev (see README — the target
// deployment environment's Application Control policy blocks every native
// .exe process it doesn't recognize, which rules out running a standalone
// Postgres server here; Prisma's query engine loads in-process as a Node
// addon rather than a spawned process, so it isn't affected). SQLite's
// Prisma connector doesn't support native enum types, so these are modeled
// as plain `String` columns in schema.prisma and validated at the
// application boundary (zod) instead of the database boundary.

export const ROLES = ["ADMIN", "TEACHER", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const VIOLATION_TYPES = [
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
  "DEVTOOLS_SHORTCUT",
  "PRINT_SCREEN",
  "MULTIPLE_DISPLAYS_DETECTED",
] as const;
export type ViolationType = (typeof VIOLATION_TYPES)[number];
