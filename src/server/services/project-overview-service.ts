import "server-only";

import { Prisma, ProjectActivityType } from "@prisma/client";
import { db } from "@/lib/db";

export type ProjectSummaryField =
  | "startDate"
  | "expectedEndDate"
  | "baselineProgress"
  | "actualProgress"
  | "totalProjectValue"
  | "totalProjectInvoices"
  | "totalCollectedValue"
  | "remainingUnbilledValue";

const summarySingletonKey = "ACTIVE";

const defaultSummary = {
  singletonKey: summarySingletonKey,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
  expectedEndDate: new Date("2026-12-31T00:00:00.000Z"),
  baselineProgress: new Prisma.Decimal(35),
  actualProgress: new Prisma.Decimal(28),
  totalProjectValue: new Prisma.Decimal(0),
  totalProjectInvoices: new Prisma.Decimal(0),
  totalCollectedValue: new Prisma.Decimal(0),
  remainingUnbilledValue: new Prisma.Decimal(0),
};

export async function getProjectSummary() {
  return db.projectSummary.upsert({
    where: { singletonKey: summarySingletonKey },
    create: defaultSummary,
    update: {},
  });
}

export async function getProjectDetails() {
  const [summary, activities, risks, issues] = await Promise.all([
    getProjectSummary(),
    db.projectActivity.findMany({
      orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    }),
    db.projectRisk.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.projectIssue.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return { summary, activities, risks, issues };
}

export async function updateProjectSummaryField(input: {
  field: ProjectSummaryField;
  value: string | Date | Prisma.Decimal;
}) {
  await getProjectSummary();

  return db.projectSummary.update({
    where: { singletonKey: summarySingletonKey },
    data: {
      [input.field]: input.value,
    },
  });
}

export async function createActivity(input: {
  type: ProjectActivityType;
  text: string;
}) {
  return db.projectActivity.create({
    data: input,
  });
}

export async function updateActivity(input: {
  id: string;
  type: ProjectActivityType;
  text: string;
}) {
  return db.projectActivity.update({
    where: { id: input.id },
    data: {
      type: input.type,
      text: input.text,
    },
  });
}

export async function deleteActivity(id: string) {
  return db.projectActivity.delete({
    where: { id },
  });
}

export type RiskInput = {
  description: string;
  date: Date | null;
  impact: string;
  probability: string;
  owner: string;
  responsePlan: string;
  status: string;
  closureDate: Date | null;
};

export async function createRisk(input: RiskInput) {
  return db.projectRisk.create({
    data: input,
  });
}

export async function updateRisk(id: string, input: RiskInput) {
  return db.projectRisk.update({
    where: { id },
    data: input,
  });
}

export async function deleteRisk(id: string) {
  return db.projectRisk.delete({
    where: { id },
  });
}

export type IssueInput = {
  description: string;
  date: Date | null;
  owner: string;
  responsePlan: string;
  status: string;
  closureDate: Date | null;
};

export async function createIssue(input: IssueInput) {
  return db.projectIssue.create({
    data: input,
  });
}

export async function updateIssue(id: string, input: IssueInput) {
  return db.projectIssue.update({
    where: { id },
    data: input,
  });
}

export async function deleteIssue(id: string) {
  return db.projectIssue.delete({
    where: { id },
  });
}
