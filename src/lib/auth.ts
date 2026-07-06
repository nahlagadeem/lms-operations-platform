import "server-only";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentPlatformRole } from "@/lib/permissions";

const DEMO_PASSWORD = "test1234";
const DEMO_LOGIN_EMAILS = new Set([
  "admin@jawraa.demo",
  "stakeholder@jawraa.demo",
  "dataentry@jawraa.demo",
  "customer@jawraa.demo",
]);

export async function validateDemoCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!DEMO_LOGIN_EMAILS.has(normalizedEmail) || password !== DEMO_PASSWORD) {
    return null;
  }

  const user = await db.appUser.findUnique({
    where: { email: normalizedEmail },
    select: { email: true, isActive: true },
  });

  if (!user?.isActive) {
    return null;
  }

  return user.email;
}

export async function isAuthenticated() {
  return (await getCurrentPlatformRole()) !== null;
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}
