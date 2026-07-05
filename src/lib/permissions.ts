import "server-only";

import { cookies } from "next/headers";
import {
  PlatformRole as PrismaPlatformRole,
  UserRole,
  type PlatformRole,
} from "@prisma/client";
import { db } from "@/lib/db";

const AUTH_COOKIE_NAME = "lms_ops_auth";

function mapLegacyUserRoleToPlatformRole(role: UserRole): PlatformRole {
  switch (role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.PROJECT_MANAGER:
      return PrismaPlatformRole.PROJECT_MANAGER;
    case UserRole.OPERATIONS_COORDINATOR:
      return PrismaPlatformRole.DATA_ENTRY;
    case UserRole.REPORTING_ANALYST:
      return PrismaPlatformRole.KEY_STAKEHOLDER;
    case UserRole.VIEWER:
    default:
      return PrismaPlatformRole.CUSTOMER;
  }
}

export async function getCurrentPlatformRole(): Promise<PlatformRole | null> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionValue) {
    return null;
  }

  const user = await db.appUser.findUnique({
    where: { email: sessionValue },
    select: { platformRole: true, role: true },
  });

  if (!user) {
    return null;
  }

  return user.platformRole ?? mapLegacyUserRoleToPlatformRole(user.role);
}

export function canViewFinancials(role: PlatformRole | null | undefined) {
  return role === PrismaPlatformRole.PROJECT_MANAGER || role === PrismaPlatformRole.KEY_STAKEHOLDER;
}

export function canEditOperationalData(role: PlatformRole | null | undefined) {
  return role === PrismaPlatformRole.PROJECT_MANAGER || role === PrismaPlatformRole.DATA_ENTRY;
}

export function canCreateOperationalData(role: PlatformRole | null | undefined) {
  return canEditOperationalData(role);
}

export function canManageFinancialFields(role: PlatformRole | null | undefined) {
  return role === PrismaPlatformRole.PROJECT_MANAGER;
}

export function isCustomerCapacityOnly(role: PlatformRole | null | undefined) {
  return role === PrismaPlatformRole.CUSTOMER;
}

export function canViewOperationalData(role: PlatformRole | null | undefined) {
  return role !== null && role !== undefined;
}

export function assertPermission(
  role: PlatformRole | null | undefined,
  allowed: (value: PlatformRole | null | undefined) => boolean,
  message = "Forbidden.",
) {
  if (!allowed(role)) {
    throw new Error(message);
  }
}
