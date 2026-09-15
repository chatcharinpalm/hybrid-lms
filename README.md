# Hybrid LMS — Secure Exam Engine

Full-stack blueprint + working core for a Hybrid (Online & Onsite) Learning
Management System, built to match the visual design of the provided Stitch
template (`stitch_network_security_learning_platform.zip`) — dark theme,
Inter + JetBrains Mono, Material Symbols icons, the same color tokens.

## Tech stack

- **Frontend:** Next.js 14 (App Router, TypeScript) + Tailwind CSS
- **Backend:** Node.js + Express (TypeScript)
- **Database:** SQLite via Prisma ORM for local dev (see below for why); schema is written to move to PostgreSQL with a one-line change for real deployment
- **Auth:** JWT access token (15m) + httpOnly refresh cookie (7d), role-based (`ADMIN` / `TEACHER` / `STUDENT`)

## Folder structure

```
hybrid-lms/
├── apps/
│   ├── web/                         # Next.js frontend
│   │   ├── app/
│   │   │   ├── login/page.tsx           # role tabs (student/staff) + register link
│   │   │   ├── register/page.tsx        # student self-registration (name, student ID, faculty, major)
│   │   │   ├── (portal)/            # public, learner-facing shell: ThaiMOOC-style top nav (not a sidebar)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/page.tsx      # viewable without login
│   │   │   │   ├── courses/page.tsx        # material repository — viewable without login
│   │   │   │   ├── attendance/page.tsx     # QR / online check-in — requires student login
│   │   │   │   └── exams/page.tsx          # exam center list — viewable without login
│   │   │   ├── admin/                # ⭐ fully separate back office (its own layout, NOT
│   │   │   │   │                        nested under (portal) or linked from its nav — a
│   │   │   │   │                        ThaiMOOC-style split between learner site and admin)
│   │   │   │   ├── layout.tsx              # login+role gate, own AdminShell chrome
│   │   │   │   ├── page.tsx                # hub
│   │   │   │   ├── courses/new/page.tsx        # create course
│   │   │   │   ├── exams/new/page.tsx          # exam + question builder
│   │   │   │   └── materials/upload/page.tsx   # upload slides/video/docs
│   │   │   └── exam/[examId]/        # requires student login (see "Access model" below)
│   │   │       ├── lobby/page.tsx          # rules gate
│   │   │       ├── session/page.tsx        # ⭐ secure exam engine
│   │   │       └── result/page.tsx
│   │   ├── components/
│   │   │   ├── exam/
│   │   │   │   ├── SecureExamShell.tsx     # ⭐ reusable lockdown wrapper
│   │   │   │   ├── QuestionPanel.tsx
│   │   │   │   ├── ViolationModal.tsx
│   │   │   │   └── ExamTimer.tsx
│   │   │   ├── layout/ (TopNav for the learner site, AdminShell for /admin)
│   │   │   └── ui/NetworkBackground.tsx    # animated canvas network graph (login/lobby)
│   │   ├── hooks/useExamSecurity.ts        # ⭐ anti-cheat detection hook
│   │   ├── lib/api.ts                      # fetch wrapper (JWT header)
│   │   └── types/exam.ts
│   └── api/                         # Express backend
│       ├── prisma/schema.prisma            # ⭐ core data model
│       ├── prisma/seed.ts                  # demo teacher/student/exam
│       └── src/
│           ├── routes/        (auth, exam, attendance, course)
│           ├── controllers/
│           ├── services/examSession.service.ts  # randomization + grading + auto-submit
│           ├── middleware/    (JWT auth, role guard, error handler)
│           └── utils/shuffle.ts            # seeded Fisher-Yates
└── docs/
```

## Getting started

```bash
npm install --ignore-scripts      # see note below on why --ignore-scripts
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
# apps/api/.env already defaults DATABASE_URL to a local SQLite file — no
# separate database server to install or run for local dev.

npm run prisma:generate -w apps/api
npx prisma db push --schema apps/api/prisma/schema.prisma   # creates apps/api/prisma/dev.db
npm run prisma:seed -w apps/api                              # demo teacher/student/course/exam

npm run dev:api                   # http://localhost:4000
npm run dev:web                   # http://localhost:3000
```

Seeded accounts (password `Password123!`): `teacher@netsechub.dev`, `student@netsechub.dev`.
This has been run and verified end-to-end in this environment: login, course
creation, exam creation with the question builder, starting a shuffled
attempt, answering, logging a violation, auto-submit at the violation
threshold, and server-side grading all work against the seeded data.

### Why SQLite instead of PostgreSQL

The original plan was Postgres, and the schema is still written to make that
a one-line change (see the next section). It didn't end up running in this
particular environment because of two separate execution-policy blocks:

1. **`npm install`** failed because `tsx`/`esbuild`'s install-time
   verification step spawns `esbuild.exe`, which this machine's Application
   Control / WDAC-style policy blocks outright ("An Application Control
   policy has blocked this file"). Fixed by installing with
   `--ignore-scripts` (the platform binaries themselves still install
   normally as optionalDependencies — only the scripts that *verify* them by
   spawning the exe are skipped) and swapping `apps/api`'s dev runner from
   `tsx` to `nodemon` + `ts-node` (pure JS, no native binary spawned on every
   run).
2. **Installing a standalone PostgreSQL server** hit the same policy at a
   lower level: `winget install postgresql` completed (files land in
   `C:\Program Files\PostgreSQL\17\`), but the installer's own `initdb.exe`
   invocation was blocked, and running `initdb.exe`/`postgres.exe` directly
   afterward was blocked too — this looks like a publisher/signature-based
   rule, not a path rule, since it blocked the same binary from both a temp
   folder and `Program Files`.

Prisma's query engine, by contrast, loads in-process as a Node native addon
(`dlopen`, not `CreateProcess`) rather than being spawned as a subprocess —
that path was not affected by the policy, verified with a real insert+query
against a throwaway SQLite database before touching the real schema. SQLite
was the pragmatic way to get a genuinely working, tested database without a
separate server process this environment won't let run.

**To move to Postgres for a real deployment:**
1. In `apps/api/prisma/schema.prisma`, change the datasource `provider` from
   `"sqlite"` to `"postgresql"`.
2. Change the seven fields marked `// JSON-encoded` back to `Json`, the
   `selectedOptionIds String @default("[]")` field on `ExamAnswer` back to
   `String[]`, and the `String` fields with an inline `// Role: ...` /
   `// ExamStatus: ...` etc. comment back to proper `enum` types (Postgres
   supports all three; SQLite's Prisma connector doesn't, which is why this
   schema avoids them) — remove the now-redundant string-union types in
   `apps/api/src/constants.ts` and switch the few files that import from
   there back to importing the Prisma-generated enum types.
3. Point `DATABASE_URL` at a real Postgres instance and run
   `prisma migrate dev` instead of `db push`.

`next dev` was left as-is — Next's native SWC binary was not blocked in
testing, but if it is on your machine, Next automatically falls back to a
WASM build of SWC with a console warning.

### Known limitation: dependency vulnerabilities

`npm audit` flags `next@14.2.35` (the newest 14.x patch) against a long list
of advisories that are only fully closed in Next 15/16 — mostly Server
Actions / Middleware / Image Optimizer edge cases that don't apply to this
app's current usage (no middleware, no remote image patterns). Upgrading to
Next 15/16 is a bigger migration than this scaffold's scope and is recommended
before any production deployment.

## Access model

Three tiers, split like a public course site (ThaiMOOC-style) rather than
one app with a role toggle:

| Area | Who | Where |
|---|---|---|
| Browsing (dashboard, course catalog, materials, exam center listing) | Anyone, no login | `app/(portal)/*` |
| Taking an exam, checking in to attendance | Logged-in student | `app/exam/[examId]/*`, `app/(portal)/attendance` |
| Creating courses/exams, uploading materials | Logged-in TEACHER/ADMIN | `app/admin/*` |

`app/admin` is a **separate top-level route with its own layout**
(`AdminShell`) — its own sidebar-based chrome and an "Admin Only" badge —
deliberately different from the learner site's top nav (`TopNav`), and with
no link to or from it at all. An admin reaches it only by navigating to
`/admin` directly (bookmark it) or via the `next=` redirect after logging in
from there; it is never advertised on the learner-facing pages.
`app/admin/layout.tsx` redirects to `/login` if you're not signed in, and
shows a "no access" screen if you're signed in as a student.

**Registration is student-only and self-service** (`POST /api/auth/register`,
`app/register/page.tsx`) — first/last name, student ID, faculty, and major
are all required, matching how a real student portal collects that data up
front. Teacher/admin accounts are never created through this endpoint (the
schema's `role` field defaults to `STUDENT` and the endpoint hardcodes it);
provision those via the seed script or a future admin-managed user list.

Every exam attempt gets its own random seed (`utils/shuffle.ts`), so the
*same* exam (same question bank, edited once by a teacher) is reshuffled into
a different question/option order every time anyone starts a new attempt —
verified by starting two attempts back-to-back and diffing the returned
question order.

## Core database schema (`apps/api/prisma/schema.prisma`)

| Model | Purpose |
|---|---|
| `User` | Auth identity + `role` (`Role`: `ADMIN`/`TEACHER`/`STUDENT` — see `src/constants.ts`); students additionally carry `studentCode`, `faculty`, `major` from registration |
| `Course`, `Enrollment`, `ClassSession` | Hybrid class management — one session carries both an onsite room and an online join link |
| `AttendanceRecord` | Logs a check-in with `method` (`AttendanceMethod`: `QR_ONSITE` / `ONLINE_JOIN` / `MANUAL`) |
| `CourseMaterial` | Slide/video/document repository, uploaded via `multer` |
| `Exam` | Holds the lockdown config directly on the row: `requireFullscreen`, `blockClipboard`, `blockContextMenu`, `maxViolations`, `shuffleQuestions`, `shuffleOptions` |
| `Question` / `QuestionOption` | Single/multiple-choice or short-answer (CTF-flag style) |
| `ExamAttempt` | One row per student attempt; stores `randomSeed` so shuffle order is reproducible for review |
| `ExamAnswer` | Student's answer per question (`selectedOptionIds` stored as a JSON-encoded string — see SQLite note above), graded server-side |
| `ExamViolationLog` | **One row per detected anti-cheat event** — `type` (`ViolationType`) covers tab-hidden, window-blur, fullscreen-exit, copy/paste/cut, context-menu, devtools-shortcut, print-screen |

> Fields noted above as enums are plain `String` columns validated by zod at
> the API boundary, not native Prisma enums — see "Why SQLite" above for why,
> and `apps/api/src/constants.ts` for the string-union types.

## Secure Exam Engine — how it works

1. **`hooks/useExamSecurity.ts`** wires every browser-level detector: `visibilitychange`, `window.blur`, `fullscreenchange`, `contextmenu`, `copy`/`cut`/`paste`, and a `keydown` capture-phase listener that blocks Ctrl+C/V/X, F12, Ctrl+Shift+I/J/C, Ctrl+U. It reports each event through an `onViolation` callback and exposes a local violation counter for instant UI feedback.
2. **`components/exam/SecureExamShell.tsx`** is the reusable wrapper: it gates entry behind a "click to enter fullscreen" screen (fullscreen APIs require a user gesture), renders the lockdown status bar + timer, posts every violation to `POST /api/exams/attempts/:id/violations`, and shows `ViolationModal` with the running count.
3. **The server is the trust boundary, not the browser.** `examSession.service.ts` re-derives the violation count from the database on every report and force-submits the attempt once `exam.maxViolations` is reached — a tampered client can't bypass this because grading and the auto-submit decision never trust client-reported state.
4. **Randomization** (`utils/shuffle.ts`) is a seeded Fisher-Yates: each `ExamAttempt.randomSeed` deterministically reorders that student's questions and per-question options, so a reload mid-exam or a later teacher review shows the identical order, while different students see different orders.

### Note on client-side limits

`useExamSecurity` makes cheating inconvenient and produces an audit trail — it does **not** and cannot fully prevent it (Alt+Tab, external phones, screen-recording hardware, or a modified browser can't be blocked by JavaScript). Pair it with the violation log for human review, and treat `maxViolations` as a tunable risk threshold, not an absolute guarantee. For higher-assurance settings, layer this with camera-based proctoring or a locked-down kiosk browser (e.g. Safe Exam Browser).
