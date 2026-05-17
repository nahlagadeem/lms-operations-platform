"use server";

import { ProviderType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as providerService from "@/server/services/provider-service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createProvider(formData: FormData) {
  const providerType = normalizeText(formData.get("providerType")) as ProviderType;
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
    redirect("/providers?panel=create&error=missing-required");
  }

  await providerService.createProvider({
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

  revalidatePath("/providers");
  redirect("/providers");
}
