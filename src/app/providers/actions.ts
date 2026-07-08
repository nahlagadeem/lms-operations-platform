"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { VendorType } from "@/lib/brd-terminology";
import {
  assertPermission,
  canCreateOperationalData,
  getCurrentPlatformRole,
} from "@/lib/permissions";
import * as vendorService from "@/server/services/vendor-service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createVendor(formData: FormData) {
  await requireAuth();
  assertPermission(await getCurrentPlatformRole(), canCreateOperationalData);

  const providerType = normalizeText(formData.get("providerType")) as VendorType;
  const nameAr = normalizeText(formData.get("nameAr"));
  const nameEn = normalizeText(formData.get("nameEn"));
  const country = normalizeText(formData.get("country"));
  const city = normalizeText(formData.get("city"));
  const contactPerson = normalizeText(formData.get("contactPerson"));
  const email = normalizeText(formData.get("email"));
  const phone = normalizeText(formData.get("phone"));
  const website = normalizeText(formData.get("website"));
  const notes = normalizeText(formData.get("notes"));

  if (!providerType || !nameAr) {
    redirect("/vendors?panel=create&error=missing-required");
  }

  await vendorService.createVendor({
    providerType,
    nameAr,
    nameEn,
    country,
    city,
    contactPerson,
    email,
    phone,
    website,
    notes,
  });

  revalidatePath("/vendors");
  redirect("/vendors");
}
