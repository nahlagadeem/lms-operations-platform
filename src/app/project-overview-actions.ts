"use server";

import { ProjectActivityType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  assertPermission,
  canEditOperationalData,
  canManageFinancialFields,
  getCurrentPlatformRole,
} from "@/lib/permissions";
import * as projectOverviewService from "@/server/services/project-overview-service";
import type { ProjectSummaryField } from "@/server/services/project-overview-service";

const summaryFields = new Set<ProjectSummaryField>([
  "startDate",
  "expectedEndDate",
  "baselineProgress",
  "actualProgress",
  "totalProjectValue",
  "totalProjectInvoices",
  "totalCollectedValue",
  "remainingUnbilledValue",
]);

const financialSummaryFields = new Set<ProjectSummaryField>([
  "totalProjectValue",
  "totalProjectInvoices",
  "totalCollectedValue",
  "remainingUnbilledValue",
]);

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseRequiredDate(value: string, message: string) {
  const date = parseOptionalDate(value);
  if (!date) {
    throw new Error(message);
  }
  return date;
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDecimal(value: string, message: string) {
  if (!value) {
    throw new Error(message);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(message);
  }

  return new Prisma.Decimal(parsed);
}

function parsePercentage(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Percentage must be a number between 0 and 100.");
  }

  return new Prisma.Decimal(parsed);
}

function parseActivityType(value: string) {
  if (value === ProjectActivityType.PREVIOUS) return ProjectActivityType.PREVIOUS;
  if (value === ProjectActivityType.CURRENT) return ProjectActivityType.CURRENT;
  if (value === ProjectActivityType.UPCOMING) return ProjectActivityType.UPCOMING;
  throw new Error("Activity type is invalid.");
}

function requireValue(value: string, message: string) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function requireOperationalEditAccess() {
  const role = await getCurrentPlatformRole();
  assertPermission(role, canEditOperationalData);
}

async function requireFinancialEditAccess() {
  const role = await getCurrentPlatformRole();
  assertPermission(role, canManageFinancialFields);
}

export async function updateProjectSummaryField(formData: FormData) {
  await requireAuth();

  const field = normalizeText(formData.get("field")) as ProjectSummaryField;
  const value = normalizeText(formData.get("value"));

  if (!summaryFields.has(field)) {
    throw new Error("Project summary field is invalid.");
  }

  if (financialSummaryFields.has(field)) {
    await requireFinancialEditAccess();
  } else {
    await requireOperationalEditAccess();
  }

  let parsedValue: string | Date | Prisma.Decimal;

  if (field === "startDate" || field === "expectedEndDate") {
    parsedValue = parseRequiredDate(value, "Please enter a valid date.");
  } else if (field === "baselineProgress" || field === "actualProgress") {
    parsedValue = parsePercentage(value);
  } else {
    parsedValue = parseDecimal(value, "Please enter a valid number.");
  }

  await projectOverviewService.updateProjectSummaryField({
    field,
    value: parsedValue,
  });

  revalidatePath("/");
  revalidatePath("/project-details");
}

export async function createActivity(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const type = parseActivityType(normalizeText(formData.get("type")));
  const text = requireValue(
    normalizeText(formData.get("text")),
    "Please enter activity text.",
  );

  await projectOverviewService.createActivity({ type, text });
  revalidatePath("/project-details");
}

export async function updateActivity(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing activity.");
  const type = parseActivityType(normalizeText(formData.get("type")));
  const text = requireValue(
    normalizeText(formData.get("text")),
    "Please enter activity text.",
  );

  await projectOverviewService.updateActivity({ id, type, text });
  revalidatePath("/project-details");
}

export async function deleteActivity(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing activity.");
  await projectOverviewService.deleteActivity(id);
  revalidatePath("/project-details");
}

function parseRisk(formData: FormData) {
  return {
    description: requireValue(
      normalizeText(formData.get("description")),
      "Please enter a risk description.",
    ),
    date: parseOptionalDate(normalizeText(formData.get("date"))),
    impact: requireValue(normalizeText(formData.get("impact")), "Please enter impact."),
    probability: requireValue(
      normalizeText(formData.get("probability")),
      "Please enter probability.",
    ),
    owner: requireValue(normalizeText(formData.get("owner")), "Please enter owner."),
    responsePlan: requireValue(
      normalizeText(formData.get("responsePlan")),
      "Please enter response plan.",
    ),
    status: requireValue(normalizeText(formData.get("status")), "Please enter status."),
    closureDate: parseOptionalDate(normalizeText(formData.get("closureDate"))),
  };
}

export async function createRisk(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  await projectOverviewService.createRisk(parseRisk(formData));
  revalidatePath("/project-details");
}

export async function updateRisk(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing risk.");
  await projectOverviewService.updateRisk(id, parseRisk(formData));
  revalidatePath("/project-details");
}

export async function deleteRisk(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing risk.");
  await projectOverviewService.deleteRisk(id);
  revalidatePath("/project-details");
}

function parseIssue(formData: FormData) {
  return {
    description: requireValue(
      normalizeText(formData.get("description")),
      "Please enter an issue description.",
    ),
    date: parseOptionalDate(normalizeText(formData.get("date"))),
    owner: requireValue(normalizeText(formData.get("owner")), "Please enter owner."),
    responsePlan: requireValue(
      normalizeText(formData.get("responsePlan")),
      "Please enter response plan.",
    ),
    status: requireValue(normalizeText(formData.get("status")), "Please enter status."),
    closureDate: parseOptionalDate(normalizeText(formData.get("closureDate"))),
  };
}

export async function createIssue(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  await projectOverviewService.createIssue(parseIssue(formData));
  revalidatePath("/project-details");
}

export async function updateIssue(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing issue.");
  await projectOverviewService.updateIssue(id, parseIssue(formData));
  revalidatePath("/project-details");
}

export async function deleteIssue(formData: FormData) {
  await requireAuth();
  await requireOperationalEditAccess();

  const id = requireValue(normalizeText(formData.get("id")), "Missing issue.");
  await projectOverviewService.deleteIssue(id);
  revalidatePath("/project-details");
}
