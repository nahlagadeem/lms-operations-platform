"use server";

import { LocationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalInt(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createLocation(formData: FormData) {
  const locationType = normalizeText(formData.get("locationType")) as LocationType;
  const nameAr = normalizeText(formData.get("nameAr"));
  const nameEn = normalizeText(formData.get("nameEn"));
  const country = normalizeText(formData.get("country"));
  const city = normalizeText(formData.get("city"));
  const branch = normalizeText(formData.get("branch"));
  const venueName = normalizeText(formData.get("venueName"));
  const roomName = normalizeText(formData.get("roomName"));
  const address = normalizeText(formData.get("address"));
  const timezone = normalizeText(formData.get("timezone"));
  const capacity = parseOptionalInt(normalizeText(formData.get("capacity")));

  if (!locationType || !nameAr) {
    throw new Error("Missing required location fields.");
  }

  await db.location.create({
    data: {
      locationType,
      nameAr,
      nameEn: nameEn || null,
      country: country || null,
      city: city || null,
      branch: branch || null,
      venueName: venueName || null,
      roomName: roomName || null,
      address: address || null,
      timezone: timezone || null,
      capacity,
    },
  });

  revalidatePath("/locations");
  redirect("/locations");
}
