import "server-only";

import { redirect } from "next/navigation";
import { getCurrentPlatformRole } from "@/lib/permissions";

export async function isAuthenticated() {
  return (await getCurrentPlatformRole()) !== null;
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}
