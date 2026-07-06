# LMS Operations Platform - AI Development Handoff

## Repository
- Current branch: `feature/project-scope-to-purchase-order`
- Current HEAD commit: `7e5a481734f8c583dcc643160a1d657e1dcad084`
- Current status (working tree clean/dirty): clean after the PTSP-20 attendance grid commit

## Overall Project Status
- Overall completion estimate: about 4 of 14 PTSP stories are complete, or roughly 29%; PTSP-16, PTSP-17, PTSP-19, and PTSP-20 are complete for demo/staging, and the remaining PTSP stories are still open.
- PTSP stories completed: `PTSP-16`, `PTSP-17`, `PTSP-19`, `PTSP-20`
- PTSP stories in progress: none
- PTSP stories not started: `PTSP-21`, `PTSP-22`, `PTSP-23`, `PTSP-24`, `PTSP-25`, `PTSP-27`, `PTSP-28`, `PTSP-29`, `PTSP-30`, `PTSP-32`

## Completed PTSP Stories
### PTSP-16
- Summary: Established platform-role-based RBAC across auth, navigation, dashboard, project details, project structure, trainings, courses, packages, providers, locations, API exports, demo data, and demo login helpers.
- Commits related: `e4243b3`, `ad3302a`, `e106547`, `9d16eda`, `714ff3e`, `2afe4e8`, `1f628a7`, `2ab8138`, `8e4d32f`, `3f7d466`, `d5c3d19`
- Main files modified: `prisma/schema.prisma`, `prisma/migrations/20260622160000_platform_role/migration.sql`, `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/dashboard-report/route.ts`, `src/app/project-details/page.tsx`, `src/app/project-overview-actions.ts`, `src/app/project-structure/actions.ts`, `src/app/project-structure/page.tsx`, `src/app/project-structure/scopes/[id]/page.tsx`, `src/app/course-runs/actions.ts`, `src/app/course-runs/page.tsx`, `src/app/course-runs/[id]/page.tsx`, `src/app/providers/actions.ts`, `src/app/providers/page.tsx`, `src/app/locations/actions.ts`, `src/app/locations/page.tsx`, `src/app/courses/page.tsx`, `src/app/courses/[id]/page.tsx`, `src/app/packages/[id]/page.tsx`, `src/app/api/course-run-documents/route.ts`, `src/app/api/project-documents/route.ts`, `src/app/api/project-documents/delete/route.ts`, `src/app/api/project-report/export/route.ts`, `scripts/seed-realistic-demo.ts`
- Notes: demo/staging ready; production still needs opaque session hardening.

### PTSP-17
- Summary: Verified that user-facing "Active Course(s)" and "Course Run(s)" terminology has already been replaced with "Training(s)" across the app UI.
- Commits related: `docs: mark PTSP-17 training terminology complete`
- Main files modified: `docs/AI_PROGRESS.md`
- Notes: No application code changes were needed. Remaining `course run(s)`, `runCode`, and `activeRuns` references are internal identifiers, technical documentation, maintenance-script output, or already render as Training/Trainings.

## PTSP-19 Summary
- Status: complete for demo/staging.
- TrainingSession schema added as a first-class model related to `CourseRun`.
- Server-side `TrainingSession` create/update service functions and server actions added.
- Session mutations use the existing operational permission guard, allowing `PROJECT_MANAGER` and `DATA_ENTRY` while blocking read-only roles.
- Session dates are normalized to start-of-day before saving.
- Training detail page now shows a Sessions panel with total session count, session dates, and notes.
- `PROJECT_MANAGER` and `DATA_ENTRY` can add and edit sessions from the Training detail page; read-only roles see sessions without mutation controls.
- Training detail and training list now display duration/session count from `TrainingSession` count instead of the legacy `daysHeld` field.
- Accepted caveat: legacy `daysHeld` still exists in schema, actions, services, and create/edit forms for backward compatibility.
- Attendance work belongs to `PTSP-20`; `PTSP-19` intentionally does not change `AttendanceRecord` or attendance UI.

## PTSP-20 Summary
- Status: complete for demo/staging.
- `AttendanceRecord` is linked to `TrainingSession` through optional `trainingSessionId`.
- Backfill script added so existing records can be linked to `TrainingSession` where dates match.
- Unmatched attendance records remain nullable for review.
- New attendance writes use `trainingSessionId`; when a session is provided, course and date are derived from the session and `trainingSessionId` is written.
- Attendance form now submits `trainingSessionId` by selecting from existing Training sessions.
- If a training has no sessions, the attendance form is not rendered and the user is asked to add sessions first.
- Attendance grid added to Training detail: enrolled/confirmed attendees are rows, Training sessions are columns, and editable cells submit `trainingSessionId` through the existing `recordAttendance` action.
- `PROJECT_MANAGER` and `DATA_ENTRY` can edit attendance from the grid.
- `KEY_STAKEHOLDER` and `CUSTOMER` see attendance as read-only.
- Intentional legacy compatibility: `attendanceDate` still exists temporarily.
- Intentional legacy compatibility: legacy date-only attendance writes are preserved when no session is provided.
- Legacy date-only attendance rows are displayed in the grid only when their date matches an existing Training session.

## PTSP-16 Summary
- Platform roles: added `PlatformRole` with `PROJECT_MANAGER`, `KEY_STAKEHOLDER`, `DATA_ENTRY`, and `CUSTOMER`; added `AppUser.platformRole`; seeded demo users for each role.
- Auth changes: `admin/admin` still works and resolves to `admin@jawraa.demo`; auth now resolves role from `AppUser`; raw role-cookie authentication is rejected in proxy; login is still email-based for the demo session cookie.
- Permission helpers: `getCurrentPlatformRole`, `canViewFinancials`, `canEditOperationalData`, `canCreateOperationalData`, `canManageFinancialFields`, `isCustomerCapacityOnly`, `assertPermission`.
- Dashboard RBAC: removed query-string role behavior; dashboard now uses resolved platform role; financial summary and reporting output are hidden for non-financial roles; dashboard report export returns `403` for non-financial roles.
- Financial visibility: financial data is visible only to `PROJECT_MANAGER` and `KEY_STAKEHOLDER`.
- Training RBAC: training list create controls are operational-role only; training detail create/edit surfaces are role-gated; `vendorCost` is protected on both create and update paths; non-financial edits preserve existing `vendorCost`.
- Project RBAC: project details hide financial sections for non-financial roles; project edit controls are role-gated; customer users are redirected away.
- PO RBAC: project structure and scope pages gate create/edit/delete and financial fields; customer users are redirected away.
- Provider/location RBAC: provider and location create actions require operational create permission; create controls are hidden from read-only roles; customer users are redirected away from management pages.
- API 403 handling: document upload/delete and report export routes now return explicit `403` responses when the role lacks permission.
- Demo role login: login page has an environment-gated demo selector for role-based testing; selector is enabled with `ENABLE_DEMO_ROLE_LOGIN=true`.
- Demo seed users: `admin@jawraa.demo` (`PROJECT_MANAGER`), `stakeholder@jawraa.demo` (`KEY_STAKEHOLDER`), `dataentry@jawraa.demo` (`DATA_ENTRY`), `customer@jawraa.demo` (`CUSTOMER`).

## Remaining PTSP-16 Limitations
- Plain email session cookie: the session is still a plain email identity, not a signed opaque token.
- Production security improvements: the demo login flow is intentionally simple and should not be treated as production-grade authentication.
- Intentional demo-only behavior: the role selector is gated behind `ENABLE_DEMO_ROLE_LOGIN=true`.

## Git History
- `e4243b3` - Protect training `vendorCost` on non-financial edits.
- `ad3302a` - Resolve platform roles from `AppUser` only and reject raw role cookies.
- `e106547` - Add the platform-role foundation in Prisma, auth, login, and layout.
- `9d16eda` - Return explicit `403` responses for protected API routes.
- `714ff3e` - Gate project details and PO/project structure financial access.
- `2afe4e8` - Gate trainings list access by platform role.
- `1f628a7` - Align dashboard access with platform roles.
- `2ab8138` - Guard provider, vendor, and location mutations.
- `8e4d32f` - Gate course and package pricing views.
- `3f7d466` - Seed demo users for all platform roles.
- `d5c3d19` - Add the demo-only role login selector.
- `docs: mark PTSP-17 training terminology complete` - Document PTSP-17 as complete after verifying no user-facing legacy wording remains.
- `feat(training): add training session model` - Add the PTSP-19 `TrainingSession` schema and migration.
- `feat(training): add session service and actions` - Add PTSP-19 server-side session create/update service functions and actions.
- `feat(training): add sessions panel to training detail` - Show Training sessions and add/edit controls on the Training detail page.
- `feat(training): display duration from session count` - Use `TrainingSession` count for visible session/duration counts.
- `feat(attendance): link attendance records to training sessions` - Add the nullable PTSP-20 attendance-to-session schema link.
- `chore(attendance): add training session backfill script` - Add an idempotent script to link existing attendance rows to matching training sessions.
- `feat(attendance): write attendance against training sessions` - Update attendance write services/actions to support session-backed attendance while preserving legacy date writes.
- `feat(attendance): select training session for attendance entry` - Update the existing attendance form to submit `trainingSessionId`.
- `feat(attendance): add enrollee session attendance grid` - Add the per-attendee, per-session attendance grid on Training detail.
- `docs: mark PTSP-20 attendance grid complete` - Document PTSP-20 as complete for demo/staging.

## Architecture Decisions
- `PlatformRole` is the source of truth for RBAC.
- Financial visibility must use permission helpers, not ad hoc checks.
- Raw role cookies are forbidden as authentication.
- Dashboard access no longer uses query-string roles.
- `vendorCost` protection must remain server-side and UI-side.
- The demo login selector must stay environment-gated.
- Customer users are capacity/read-only users, not partial admins.

## Testing
- Seed users: `admin@jawraa.demo`, `stakeholder@jawraa.demo`, `dataentry@jawraa.demo`, `customer@jawraa.demo`.
- Demo login: set `ENABLE_DEMO_ROLE_LOGIN=true` to show the role selector on the login page.
- Manual role-testing checklist: log in as each seeded role; verify nav visibility; verify dashboard financial visibility; verify training list/detail access; verify `vendorCost` visibility and editing; verify course and package pricing visibility; verify Add Training visibility; verify project details access; verify PO/project structure access; verify provider/location access; verify document upload/delete permissions; verify report export permissions.
- Expected role matrix: `PROJECT_MANAGER` sees full access and financials; `KEY_STAKEHOLDER` sees financials but is view-only; `DATA_ENTRY` can manage operational records but sees no financial output; `CUSTOMER` sees read-only capacity information only.

## Next Story Recommendation
- Recommend `PTSP-21`.
- Why: PTSP-20 now records per-session attendance for each enrollee, so the next dependency is calculating and presenting attendance rates correctly from session-backed attendance records.

## Coding Rules
- Never rebuild existing features.
- Modify existing implementation only.
- One atomic task per commit.
- Keep commits focused.
- Run `npm run build` before committing.
- Update `AI_PROGRESS.md` after every completed task.

## Current TODO
- First action for the next Codex session: start PTSP-21 with an architecture review of current attendance rate formulas and identify where calculations still depend on legacy attendance assumptions.
