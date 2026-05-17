"use server";

import { ProviderType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

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
    throw new Error("Please choose a training provider type and enter a name.");
  }

  await db.provider.create({
    data: {
      providerType,
      nameAr,
      nameEn: nameEn || null,
      country: country || null,
      city: city || null,
      contactPerson: contactPerson || null,
      email: email || null,
      phone: phone || null,
      website: website || null,
      notes: notes || null,
    },
  });

  revalidatePath("/providers");
  redirect("/providers");
}
