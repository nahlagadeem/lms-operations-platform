import "dotenv/config";

import {
  LocationType,
  ParticipantType,
  PlatformRole,
  Prisma,
  UserRole,
} from "@prisma/client";
import { db } from "../src/lib/db";

/**
 * LOCAL/DEMO DATABASE ONLY.
 *
 * This script clears transactional demo activity and leaves only the static
 * catalog plus a tiny manual-testing dataset. It intentionally refuses to run
 * unless DATABASE_URL points to localhost/127.0.0.1/::1.
 */

const DEMO_USERS = [
  {
    fullName: "JAWRAA Demo Admin",
    email: "admin@jawraa.demo",
    role: UserRole.SUPER_ADMIN,
    platformRole: PlatformRole.PROJECT_MANAGER,
    department: "Project Office",
  },
  {
    fullName: "Key Stakeholder",
    email: "stakeholder@jawraa.demo",
    role: UserRole.REPORTING_ANALYST,
    platformRole: PlatformRole.KEY_STAKEHOLDER,
    department: "Leadership Office",
  },
  {
    fullName: "Data Entry",
    email: "dataentry@jawraa.demo",
    role: UserRole.OPERATIONS_COORDINATOR,
    platformRole: PlatformRole.DATA_ENTRY,
    department: "Operations",
  },
  {
    fullName: "Customer",
    email: "customer@jawraa.demo",
    role: UserRole.VIEWER,
    platformRole: PlatformRole.CUSTOMER,
    department: "Customer",
  },
] as const;

const DEMO_LOGIN_EMAILS = DEMO_USERS.map((user) => user.email);

const DEMO_STUDENTS = [
  "Nahla Abubaker",
  "Mahmoud Hilbawi",
  "Ahmed Abazah",
  "Hind Abubaker",
] as const;

const DEMO_TRAINERS = [
  "Hadia Abubaker",
  "Zainab Ibrahim",
] as const;

const STATIC_LOCATIONS = [
  ["demo-location-riyadh", "Riyadh"],
  ["demo-location-jeddah", "Jeddah"],
  ["demo-location-dammam", "Dammam"],
  ["demo-location-khobar", "Khobar"],
  ["demo-location-makkah", "Makkah"],
  ["demo-location-madinah", "Madinah"],
  ["demo-location-taif", "Taif"],
  ["demo-location-abha", "Abha"],
  ["demo-location-tabuk", "Tabuk"],
  ["demo-location-hail", "Hail"],
  ["demo-location-jubail", "Jubail"],
  ["demo-location-najran", "Najran"],
  ["demo-location-yanbu", "Yanbu"],
] as const;

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const parsed = new URL(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      `Refusing to reset non-local database host "${parsed.hostname}". This script is LOCAL/DEMO DATABASE ONLY.`,
    );
  }
}

function emailFromName(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}@jawraa.demo`;
}

async function clearTransactionalData() {
  await db.trainingEvaluation.deleteMany();
  await db.evaluation.deleteMany();
  await db.attendanceRecord.deleteMany();
  await db.nomination.deleteMany();
  await db.courseRunTrainer.deleteMany();
  await db.courseRunDocument.deleteMany();
  await db.qualityReport.deleteMany();
  await db.trainingSession.deleteMany();
  await db.courseRun.deleteMany();

  await db.document.deleteMany();
  await db.finalProjectReport.deleteMany();
  await db.auditLog.deleteMany();

  await db.trainerCredential.deleteMany();
  await db.trainer.deleteMany();
  await db.participant.deleteMany();
  await db.provider.deleteMany();
  await db.location.deleteMany();

  await db.projectScopeCourse.deleteMany();
  await db.package.updateMany({
    data: {
      scopeId: null,
      expectedTraineeCount: null,
    },
  });
  await db.projectScope.deleteMany();

  await db.projectActivity.deleteMany();
  await db.projectRisk.deleteMany();
  await db.projectIssue.deleteMany();
  await db.projectSummary.upsert({
    where: { singletonKey: "ACTIVE" },
    create: {
      singletonKey: "ACTIVE",
      baselineProgress: new Prisma.Decimal(0),
      actualProgress: new Prisma.Decimal(0),
      totalProjectValue: new Prisma.Decimal(0),
      totalProjectInvoices: new Prisma.Decimal(0),
      totalCollectedValue: new Prisma.Decimal(0),
      remainingUnbilledValue: new Prisma.Decimal(0),
    },
    update: {
      startDate: null,
      expectedEndDate: null,
      baselineProgress: new Prisma.Decimal(0),
      actualProgress: new Prisma.Decimal(0),
      totalProjectValue: new Prisma.Decimal(0),
      totalProjectInvoices: new Prisma.Decimal(0),
      totalCollectedValue: new Prisma.Decimal(0),
      remainingUnbilledValue: new Prisma.Decimal(0),
    },
  });

  await db.appUser.deleteMany({
    where: {
      email: {
        notIn: DEMO_LOGIN_EMAILS,
      },
    },
  });
}

async function seedMinimalDemoRecords() {
  for (const user of DEMO_USERS) {
    await db.appUser.upsert({
      where: { email: user.email },
      create: {
        ...user,
        isActive: true,
      },
      update: {
        fullName: user.fullName,
        role: user.role,
        platformRole: user.platformRole,
        department: user.department,
        isActive: true,
      },
    });
  }

  await db.location.createMany({
    data: STATIC_LOCATIONS.map(([id, city]) => ({
      id,
      locationType: LocationType.INTERNAL_VENUE,
      nameAr: city,
      nameEn: `${city} Training Location`,
      country: "Saudi Arabia",
      city,
      venueName: `${city} Training Location`,
      roomName: "Training Room",
      timezone: "Asia/Riyadh",
      isActive: true,
    })),
  });

  await db.participant.createMany({
    data: DEMO_STUDENTS.map((name, index) => ({
      participantType: ParticipantType.STUDENT,
      nationalIdOrIqama: `DEMO-STUDENT-${String(index + 1).padStart(3, "0")}`,
      employeeNumber: `STU-${String(index + 1).padStart(3, "0")}`,
      fullNameAr: name,
      fullNameEn: name,
      email: emailFromName(name),
      organizationName: "Jawraa Demo",
      jobTitle: "Student",
      department: "Demo",
      isActive: true,
    })),
  });

  await db.trainer.createMany({
    data: DEMO_TRAINERS.map((name, index) => ({
      fullNameAr: name,
      fullNameEn: name,
      email: emailFromName(name),
      yearsOfExperience: index === 0 ? 12 : 10,
      isApproved: true,
      approvalDate: new Date(),
      specialization: "Training Delivery",
      bio: "Demo instructor for manual training setup.",
    })),
  });
}

async function counts() {
  const [
    packages,
    courses,
    students,
    instructors,
    pos,
    trainings,
    sessions,
    enrollments,
  ] = await Promise.all([
    db.package.count(),
    db.course.count(),
    db.participant.count({ where: { participantType: ParticipantType.STUDENT } }),
    db.trainer.count(),
    db.projectScope.count(),
    db.courseRun.count(),
    db.trainingSession.count(),
    db.nomination.count(),
  ]);

  return {
    packages,
    courses,
    students,
    instructors,
    pos,
    trainings,
    sessions,
    enrollments,
  };
}

async function main() {
  assertLocalDatabase();

  console.log("LOCAL/DEMO DATABASE ONLY: resetting transactional demo data...");
  await clearTransactionalData();
  await seedMinimalDemoRecords();

  console.table(await counts());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
