"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import * as projectScopeService from "@/server/services/project-scope-service";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalInt(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseScopeForm(formData: FormData) {
  const code = normalizeText(formData.get("code"));
  const nameAr = normalizeText(formData.get("nameAr"));
  const nameEn = normalizeText(formData.get("nameEn"));
  const description = normalizeText(formData.get("description"));
  const region = normalizeText(formData.get("region"));
  const isActive = normalizeText(formData.get("status")) !== "INACTIVE";
  const startDate = parseOptionalDate(normalizeText(formData.get("startDate")));
  const expectedEndDate = parseOptionalDate(normalizeText(formData.get("expectedEndDate")));
  const notes = normalizeText(formData.get("notes"));
  const courseIds = formData
    .getAll("courseIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const file = formData.get("file");

  if (!code || !nameAr || !nameEn) {
    throw new Error("Purchase order code, Arabic name, and English name are required.");
  }

  return {
    code,
    nameAr,
    nameEn,
    description,
    region,
    isActive,
    startDate,
    expectedEndDate,
    notes,
    courseIds,
    file: file instanceof File ? file : null,
  };
}

export async function createProjectScope(formData: FormData) {
  await requireAuth();

  const createdScope = await projectScopeService.createProjectScope(parseScopeForm(formData));

  revalidatePath("/");
  revalidatePath("/pos");
  redirect(`/pos/${createdScope.id}`);
}

export async function updateProjectScope(formData: FormData) {
  await requireAuth();

  const id = normalizeText(formData.get("id"));
  if (!id) {
    throw new Error("Scope id is required.");
  }

  await projectScopeService.updateProjectScope({
    id,
    ...parseScopeForm(formData),
  });

  revalidatePath("/");
  revalidatePath("/pos");
  revalidatePath(`/pos/${id}`);
}

export async function deleteProjectScope(formData: FormData) {
  await requireAuth();

  const id = normalizeText(formData.get("id"));
  if (!id) {
    throw new Error("Scope id is required.");
  }

  await projectScopeService.deleteProjectScope(id);

  revalidatePath("/");
  revalidatePath("/pos");
}

export async function assignProjectScopeCourses(formData: FormData) {
  await requireAuth();

  const scopeId = normalizeText(formData.get("scopeId"));
  if (!scopeId) {
    throw new Error("Scope id is required.");
  }

  const courseIds = formData
    .getAll("courseIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);

  await projectScopeService.replaceProjectScopeCourses(scopeId, courseIds);

  revalidatePath("/");
  revalidatePath("/pos");
  revalidatePath(`/pos/${scopeId}`);
}

export async function removeProjectScopeCourse(formData: FormData) {
  await requireAuth();

  const scopeId = normalizeText(formData.get("scopeId"));
  const courseId = normalizeText(formData.get("courseId"));
  if (!scopeId || !courseId) {
    throw new Error("Scope id and course id are required.");
  }

  await projectScopeService.removeProjectScopeCourse(scopeId, courseId);

  revalidatePath("/");
  revalidatePath("/pos");
  revalidatePath(`/pos/${scopeId}`);
}

export async function updatePurchaseOrderCourseEntryEstimatedSeats(formData: FormData) {
  await requireAuth();

  const purchaseOrderId = normalizeText(formData.get("purchaseOrderId"));
  const purchaseOrderCourseEntryId = normalizeText(
    formData.get("purchaseOrderCourseEntryId"),
  );
  const estimatedSeats = parseOptionalInt(normalizeText(formData.get("estimatedSeats")));
  if (!purchaseOrderId || !purchaseOrderCourseEntryId) {
    throw new Error("PO and Course Entry are required.");
  }

  await projectScopeService.updatePurchaseOrderCourseEntryEstimatedSeats(
    purchaseOrderId,
    purchaseOrderCourseEntryId,
    estimatedSeats,
  );

  revalidatePath("/");
  revalidatePath("/pos");
  revalidatePath(`/pos/${purchaseOrderId}`);
  revalidatePath("/trainings");
}
