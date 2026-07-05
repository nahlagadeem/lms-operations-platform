# AI Progress

## Current State

- Branch: `feature/project-scope-to-purchase-order`
- HEAD: `577871f7a091d0761852fca9792379f507746984` (`Add training evaluation workflow`)
- Remote sync: `git pull --ff-only` reported `Already up to date.`
- Working tree: intentionally dirty with PTSP-16 RBAC / platform role work in progress.
- Do not reset, discard, overwrite, or restart this work.

## Intentional Uncommitted Work

The current uncommitted changes are centered on platform roles and permission enforcement:

- Adds `PlatformRole` to Prisma with `PROJECT_MANAGER`, `KEY_STAKEHOLDER`, `DATA_ENTRY`, and `CUSTOMER`.
- Adds `AppUser.platformRole`.
- Adds a permission helper module for current-role lookup and role capability checks.
- Changes login/session handling to use `admin@jawraa.demo` and resolve the current user's platform role.
- Updates layout navigation so customer users see a reduced navigation set.
- Hides or disables create/edit controls for users without operational edit permissions.
- Hides financial fields and export access from users without financial permissions.
- Restricts server actions and document/report API routes with permission checks.
- Gives customer users a capacity-focused training detail view.

## Already Implemented For PTSP-16

- Schema-level platform role enum and optional AppUser role field.
- Migration folder for the platform role enum and AppUser column.
- Centralized permission helpers in `src/lib/permissions.ts`.
- Auth flow now delegates authenticated state to platform role resolution.
- Root navigation varies for customer users.
- PO/project structure create, edit, delete, course assignment, estimated-seat editing, and document mutation controls are gated in UI and server actions.
- Training create/edit/enrollment/instructor/attendance/evaluation actions are gated.
- Training list create panel is gated.
- Training detail edit panels, document upload, evaluation forms, instructor removal, and enrollment edits are gated.
- Project details financial display/export are gated, and customer users are redirected away from project details.
- Project overview edits are split between operational fields and financial fields.
- Document upload/delete routes and project report export route now include permission checks.

## Completed

- PTSP-16: Fixed training vendorCost RBAC protection.
  - `vendorCost` input only renders for `PROJECT_MANAGER`.
  - Non-financial roles cannot mutate `vendorCost`, even by forged form submission.
  - Existing `vendorCost` is preserved during non-financial training edits.
  - `npx prisma generate` passed.
  - `npm run build` passed.
- PTSP-16: Removed raw role-cookie authentication.
  - Raw role-cookie authentication removed.
  - Platform role now resolves from `AppUser`.
  - `admin/admin` demo login still resolves to `admin@jawraa.demo` as `PROJECT_MANAGER`.
  - `npm run build` passed.
- PTSP-16: Added platform role foundation.
  - Schema and migration add nullable `AppUser.platformRole`.
  - Demo login writes `admin@jawraa.demo`.
  - Auth uses the shared `AppUser` platform-role resolution flow.
  - Layout uses resolved auth/role state for route protection and customer navigation.
  - `npm run build` passed.
- PTSP-16: Protected API routes now return explicit forbidden responses.
  - Document upload/delete APIs return HTTP 403 for failed operational edit permission checks.
  - Project report export returns HTTP 403 for failed financial view permission checks.
  - `npm run build` passed.
- PTSP-16: Finalized project details and PO/project structure RBAC.
  - Project details financial outputs render only for financial-view roles.
  - Project details and PO mutation controls are hidden for non-operational editors.
  - PO budget, invoiced, collected, and remaining amounts render only for financial-view roles.
  - Customer users are redirected away from project details and PO pages.
  - Project and PO server actions enforce operational or financial permissions.
  - `npm run build` passed.
- PTSP-16: Finalized trainings list RBAC.
  - Create controls render only for operational editor roles.
  - Read-only roles cannot open the create panel.
  - Training list financial fields render only for `PROJECT_MANAGER`.
  - DATA_ENTRY and CUSTOMER users do not see financial outputs on the trainings list.
  - `npm run build` passed.
- PTSP-16: Aligned dashboard access with platform roles.
  - Dashboard/home uses the resolved `AppUser` platform role instead of the old query-string role model.
  - Project financial summary values render only for financial-view roles.
  - Dashboard reporting table and CSV export render only for financial-view roles.
  - Dashboard report export API returns HTTP 403 for non-financial roles.
  - `npm run build` passed.
- PTSP-16: Guarded provider, vendor, and location mutation surfaces.
  - Provider/vendor and location create actions require operational create permission.
  - Create controls and panels render only for `PROJECT_MANAGER` and `DATA_ENTRY`.
  - Customer users are redirected away from provider/vendor and location management pages.
  - `npm run build` passed.

## Known Missing Or Incomplete For PTSP-16

- Remaining known limitation: session cookie is still a plain email identity, not an opaque signed token.
- Other CRUD surfaces outside the touched PTSP-16 files, such as packages and course pages/actions, still need review for RBAC coverage if they are in PTSP-16 scope.
- The seed data creates only the legacy `SUPER_ADMIN` user; it does not seed representative users for all platform roles.

## Recommended Next Step

Continue with the next smallest PTSP-16 correctness gap:

1. Review remaining CRUD surfaces for RBAC coverage.
2. Add role gates to packages and course pages/actions if they are in PTSP-16 scope.
3. Add representative seed users for all platform roles if needed for manual verification.
