# LMS Operations Platform - AI Development Handoff

## Repository
- Branch: `feature/project-scope-to-purchase-order`
- Latest local commit at handoff: `cc004d8`
- Working tree at handoff: clean
- Important remote note: work was pushed to `main` earlier, then `master` was updated with merged history. After the latest local commits, push again when ready.

## Current Demo State
- The app has been polished for a real-user demo.
- BRD alignment work is focused on presentation and demo readiness, not new business features.
- `npm run build` passed after the latest changes.
- The local demo database was reset with the new clean reset script.

## Completed Story Scope
- Completed and accepted for demo/staging: `PTSP-16`, `PTSP-17`, `PTSP-19`, `PTSP-20`, `PTSP-21`, `PTSP-22`, `PTSP-23`, `PTSP-24`, `PTSP-25`, `PTSP-27`, `PTSP-28`, `PTSP-29`, `PTSP-30`, `PTSP-32`.
- Core areas implemented:
  - Platform-role RBAC.
  - Trainings terminology.
  - Training sessions.
  - Per-session attendance grid.
  - Session-level attendance metrics.
  - Per-enrollee attendance summary/detail.
  - Trainings list BRD columns.
  - PO list/detail seat tracking.
  - Dashboard sections.
  - Demo email/password login.
  - Production UI polish, pagination, search, Arabic/English labels.

## Recent Production/Demo Changes
- Navigation:
  - Top menu currently shows `Home`, `POs`, `Trainings`, `Project Details`, `Packages`, `Courses`.
  - Vendors and Locations are hidden from the top menu.
  - Locations/providers routes still exist, but are not main menu items.
- Dashboard:
  - Delivery Overview card order now follows the BRD:
    - Total Trainings Planned vs Completed
    - Total Seats Committed vs Delivered
    - Overall PO Fulfillment %
    - Project Start Date
    - Expected End Date
    - Baseline Progress %
    - Actual Progress %
  - Section label changed from `Package Performance` to `Package Breakdown`.
  - Section label changed from `POs Summary` to `PO Summary`.
  - PO Summary now displays PO course-entry tracking rows:
    - PO
    - Course
    - Package
    - Estimated Seats
    - Actual Seats
    - Remaining Seats
    - Fulfillment %
    - Linked Trainings
    - Status Flag
    - View Details
  - PO Summary is hidden from `CUSTOMER`.
- Hidden dashboard sections:
  - `Courses / Course Performance` is hidden for now, not deleted.
  - `Reporting / Reporting` is hidden for now, not deleted.
  - Restore by changing these constants in `src/app/page.tsx`:
    - `SHOW_DASHBOARD_COURSE_PERFORMANCE = true`
    - `SHOW_DASHBOARD_REPORTING = true`
- Home export:
  - New Home Excel export button appears for financial roles only.
  - Uses `/api/dashboard-report?type=home`.
  - Export includes dashboard workbook sheets for Financial Overview, Delivery Overview, Quality Overview, Package Breakdown, PO Summary, and Course Performance data.
  - Export remains financial-role gated because it includes financial data.
- Courses/Packages:
  - Static catalog behavior is preserved.
  - Course detail create-training UI was removed.
- Vendor cost:
  - `PROJECT_MANAGER` and `DATA_ENTRY` can edit Training `vendorCost`.
  - Revenue, margin, and financial dashboard data remain hidden from `DATA_ENTRY` and `CUSTOMER`.

## Demo Database Reset
- Added script: `scripts/reset-demo-clean.ts`.
- Added npm command: `npm run seed:demo-clean`.
- Warning/guard: LOCAL/DEMO DATABASE ONLY. The script refuses non-local database hosts.
- Keeps:
  - Packages.
  - Courses.
  - Static locations needed for training creation.
  - Demo login users:
    - `admin@jawraa.demo / test1234` -> `PROJECT_MANAGER`
    - `stakeholder@jawraa.demo / test1234` -> `KEY_STAKEHOLDER`
    - `dataentry@jawraa.demo / test1234` -> `DATA_ENTRY`
    - `customer@jawraa.demo / test1234` -> `CUSTOMER`
  - Students:
    - Nahla Abubaker
    - Mahmoud Hilbawi
    - Ahmed Abazah
    - Hind Abubaker
  - Instructors:
    - Hadia Abubaker
    - Zainab Ibrahim
- Deletes/resets transactional/demo records:
  - POs, PO course entries, Trainings, Sessions, Enrollments, Attendance, Evaluations, Documents, project activities/risks/issues, generated reports, extra attendees, extra instructors, providers, and generated demo data.
- Last local reset counts:
  - Packages: `5`
  - Courses: `413`
  - Students: `4`
  - Instructors: `2`
  - POs: `0`
  - Trainings: `0`
  - Sessions: `0`
  - Enrollments: `0`

## Important Commits Since Production Polish
- `a9f8d1a` - Top menu label back to Home and Vendors removed.
- `5a891c7` - Added clean demo reset script.
- `8c6dbcb` - Reordered Delivery Overview cards to match BRD.
- `9767ac6` - Aligned Package Breakdown and PO Summary dashboard sections with BRD.
- `cc004d8` - Hid deferred Course Performance/Reporting sections and added Home Excel export.

## Build/Test Status
- Latest `npm run build`: passed.
- Latest demo reset script run: passed locally against `localhost`.
- Working tree after this handoff update should be clean after committing this file.

## Known Intentional Limitations
- Session cookie remains a plain email identity. This is demo/staging acceptable but not production-grade.
- Demo password validation is intentionally simple: all demo users use `test1234`.
- Hidden dashboard sections are intentionally retained in code behind flags for later restoration.
- Home Excel export is financial-role only because it exports all dashboard data including financial fields.

## Manual Demo Flow
- Login with one of the four demo users.
- Create a PO from `POs`.
- Add PO course entries from the course catalog.
- Create a Training from the PO course entry.
- Add sessions.
- Add enrollments using the four demo students.
- Mark attendance in the session grid.
- Add evaluations if needed.
- Confirm dashboard updates.
- Export Home Excel as `PROJECT_MANAGER`.

## Next Session First Steps
1. Read this file first.
2. Run `git status --short`.
3. Verify current HEAD.
4. If the user asks to restore hidden sections, only flip:
   - `SHOW_DASHBOARD_COURSE_PERFORMANCE`
   - `SHOW_DASHBOARD_REPORTING`
5. If the user asks to prepare demo data, run `npm run seed:demo-clean` only when `DATABASE_URL` is local.
6. Always run `npm run build` before committing.

## Coding Rules
- Do not rebuild existing features.
- Keep each change small and atomic.
- Preserve RBAC.
- Preserve static Packages/Courses behavior.
- Do not delete hidden dashboard sections unless explicitly requested.
- Do not run the clean reset script against non-local databases.
