import {
  ApprovalStatus,
  AttendanceStatus,
  CourseCardStatus,
  CourseRunStatus,
  DeliveryMode,
  DocumentEntityType,
  DocumentType,
  LocationType,
  NominationStatus,
  ParticipantType,
  Prisma,
  ProviderType,
  ReportStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import { db } from "../src/lib/db";

const projectScopes = [
  {
    id: "scope-01",
    code: "01",
    name: "Western Region Training Delivery",
    description: "Dummy purchase order covering Makkah, Madinah, Tabuk, and nearby delivery locations.",
    budget: 1_800_000,
    invoiced: 840_000,
    collected: 700_000,
  },
  {
    id: "scope-02",
    code: "02",
    name: "Eastern & Northern Region Training Delivery",
    description: "Dummy purchase order covering Dammam, Hail, Arar, and Sakaka delivery locations.",
    budget: 1_500_000,
    invoiced: 700_000,
    collected: 580_000,
  },
  {
    id: "scope-03",
    code: "03",
    name: "Southern & Central Region Training Delivery",
    description: "Dummy purchase order covering Jazan, Najran, Al Baha, Buraydah, and Abha delivery locations.",
    budget: 1_200_000,
    invoiced: 560_000,
    collected: 470_000,
  },
];

const providerDefinitions = [
  {
    key: "riyadh-academy",
    providerType: ProviderType.TRAINING_CENTER,
    nameEn: "Riyadh Training Academy",
    nameAr: "أكاديمية الرياض للتدريب",
    city: "الرياض",
    contactPerson: "Hassan Al-Qahtani",
    email: "hassan.alqahtani@riyadhacademy.sa",
    phone: "+966 50 421 7780",
    notes: "Assigned to PO 1.",
  },
  {
    key: "gulf-pdc",
    providerType: ProviderType.TRAINING_CENTER,
    nameEn: "Gulf Professional Development Center",
    nameAr: "مركز الخليج للتطوير المهني",
    city: "الدمام",
    contactPerson: "Maha Al-Salem",
    email: "maha.alsalem@gulfpdc.sa",
    phone: "+966 55 733 2148",
    notes: "Assigned to PO 2.",
  },
  {
    key: "al-manar",
    providerType: ProviderType.TRAINING_CENTER,
    nameEn: "Al Manar Training Institute",
    nameAr: "معهد المنار للتدريب",
    city: "ابها",
    contactPerson: "Omar Al-Farhan",
    email: "omar.alfarhan@almanartraining.sa",
    phone: "+966 56 118 9044",
    notes: "Assigned to PO 3.",
  },
];

const trainerDefinitions = [
  ["Dr. Khalid Al-Rashidi", "د. خالد الرشيدي", "Leadership and strategic planning", 28, "ICF", "Saudi", "riyadh-academy"],
  ["Dr. Fatima Al-Zahrani", "د. فاطمة الزهراني", "Change management and emotional intelligence", 24, "Dale Carnegie", "Saudi", "riyadh-academy"],
  ["Mr. Ahmed Mansour", "أ. أحمد منصور", "Communication, negotiation, and team collaboration", 22, "Dale Carnegie", "Egyptian", "riyadh-academy"],
  ["Dr. Sara Al-Otaibi", "د. سارة العتيبي", "Project management and risk management", 20, "PMI", "Saudi", "gulf-pdc"],
  ["Mr. James Mitchell", "أ. جيمس ميتشل", "Financial management and reporting", 25, "ACCA", "British", "gulf-pdc"],
  ["Dr. Mohammed Al-Ghamdi", "د. محمد الغامدي", "Data analysis and digital transformation", 23, "Microsoft", "Saudi", "gulf-pdc"],
  ["Ms. Nora Al-Harbi", "أ. نورة الحربي", "HR, talent management, and productivity", 21, "SHRM", "Saudi", "al-manar"],
  ["Dr. Robert Clarke", "د. روبرت كلارك", "Contract and procurement management", 32, "CIPS", "Canadian", "gulf-pdc"],
] as const;

const locationDefinitions = [
  ["loc-01", "الرياض", "Riyadh Training Center", "قاعة التدريب - الرياض"],
  ["loc-02", "مكة المكرمة", "Makkah Training Center", "قاعة التدريب - مكة المكرمة"],
  ["loc-03", "المدينة", "Madinah Training Center", "قاعة التدريب - المدينة"],
  ["loc-04", "الدمام", "Dammam Training Center", "قاعة التدريب - الدمام"],
  ["loc-05", "تبوك", "Tabuk Training Center", "قاعة التدريب - تبوك"],
  ["loc-06", "حائل", "Hail Training Center", "قاعة التدريب - حائل"],
  ["loc-07", "عرعر", "Arar Training Center", "قاعة التدريب - عرعر"],
  ["loc-08", "جازان", "Jazan Training Center", "قاعة التدريب - جازان"],
  ["loc-09", "نجران", "Najran Training Center", "قاعة التدريب - نجران"],
  ["loc-10", "الباحة", "Al Baha Training Center", "قاعة التدريب - الباحة"],
  ["loc-11", "سكاكا", "Sakaka Training Center", "قاعة التدريب - سكاكا"],
  ["loc-12", "بريدة", "Buraydah Training Center", "قاعة التدريب - بريدة"],
  ["loc-13", "ابها", "Abha Training Center", "قاعة التدريب - أبها"],
] as const;

const participantNames = [
  "Abdullah Al-Qahtani", "Sarah Al-Fahad", "Faisal Al-Harbi", "Noura Al-Dossari",
  "Mohammed Al-Otaibi", "Haya Al-Shehri", "Turki Al-Mutairi", "Reem Al-Zahrani",
  "Omar Al-Salem", "Lina Al-Ghamdi", "Khalid Al-Mansour", "Maha Al-Ruwaili",
  "Yousef Al-Nasser", "Dana Al-Subaie", "Sultan Al-Anzi", "Rania Al-Bishi",
  "Majed Al-Rashid", "Abeer Al-Johani", "Bandar Al-Farhan", "Mona Al-Khaldi",
  "Ahmed Al-Hussein", "Latifa Al-Saif", "Nasser Al-Yami", "Samira Al-Malki",
  "Fahad Al-Tamimi", "Ghada Al-Amri", "Ibrahim Al-Shammari", "Noor Al-Ahmadi",
  "Hassan Al-Garni", "Wedad Al-Omar", "James Wilson", "Emily Carter",
  "David Roberts", "Maria Santos", "Michael Brown", "Laura Bennett",
  "Thomas Anderson", "Sophie Martin", "Daniel Evans", "Olivia Parker",
  "Robert Johnson", "Emma Collins", "William Turner", "Grace Mitchell",
  "Christopher Hall", "Rachel Adams", "Mark Thompson", "Anna Walker",
  "Peter Clarke", "Julia Morris", "Tariq Khan", "Aisha Khan",
  "Rami Haddad", "Leila Haddad", "Karim Nasser", "Maya Nasser",
  "George Haddad", "Nadine Farah", "Samir Ibrahim", "Dalia Ibrahim",
];

const departments = ["Operations", "Finance", "HR", "IT", "Strategy", "Procurement"];
const grades = ["Specialist", "Senior Specialist", "Manager", "Senior Manager", "Director"];

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function toDate(value: string) {
  return new Date(`${value}T09:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function emailFromName(name: string, index: number) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}${index}@projectdemo.sa`;
}

function assignedParticipants(sessionIndex: number, count: number) {
  return Array.from({ length: count }, (_, offset) => {
    const index = (sessionIndex * 7 + offset) % participantNames.length;
    return participantNames[index];
  });
}

async function clearDemoOperationalData() {
  await db.attendanceRecord.deleteMany();
  await db.evaluation.deleteMany();
  await db.nomination.deleteMany();
  await db.courseRunTrainer.deleteMany();
  await db.qualityReport.deleteMany();
  await db.courseRunDocument.deleteMany();
  await db.document.deleteMany();
  await db.finalProjectReport.deleteMany();
  await db.auditLog.deleteMany();
  await db.trainerCredential.deleteMany();
  await db.trainer.deleteMany();
  await db.courseRun.deleteMany();
  await db.participant.deleteMany();
  await db.location.deleteMany();
  await db.provider.deleteMany();
  await db.projectScopeCourse.deleteMany();
  await db.package.updateMany({ data: { scopeId: null, expectedTraineeCount: null } });
  await db.projectScope.deleteMany();
  await db.appUser.deleteMany();
}

function courseFit(courseName: string) {
  const name = courseName.toLowerCase();
  if (name.includes("project") || name.includes("risk") || name.includes("contract")) {
    return { provider: "gulf-pdc", trainer: name.includes("contract") ? "Dr. Robert Clarke" : "Dr. Sara Al-Otaibi" };
  }
  if (name.includes("data") || name.includes("digital")) {
    return { provider: "gulf-pdc", trainer: "Dr. Mohammed Al-Ghamdi" };
  }
  if (name.includes("financial") || name.includes("finance")) {
    return { provider: "gulf-pdc", trainer: "Mr. James Mitchell" };
  }
  if (name.includes("hr") || name.includes("talent") || name.includes("time")) {
    return { provider: "al-manar", trainer: "Ms. Nora Al-Harbi" };
  }
  if (name.includes("communication") || name.includes("negotiation") || name.includes("team")) {
    return { provider: "riyadh-academy", trainer: "Mr. Ahmed Mansour" };
  }
  if (name.includes("change") || name.includes("emotional")) {
    return { provider: "riyadh-academy", trainer: "Dr. Fatima Al-Zahrani" };
  }
  return { provider: "riyadh-academy", trainer: "Dr. Khalid Al-Rashidi" };
}

async function main() {
  await clearDemoOperationalData();

  const packages = await db.package.findMany({
    orderBy: { code: "asc" },
    include: {
      courses: {
        orderBy: { courseCode: "asc" },
      },
    },
  });

  if (packages.length === 0) {
    throw new Error("No packages found. Import the existing course catalog before seeding demo activity.");
  }

  const allCourses = packages.flatMap((pkg) => pkg.courses);
  if (allCourses.length === 0) {
    throw new Error("No courses found. Import the existing course catalog before seeding demo activity.");
  }
  const packagesWithCourses = packages.filter((pkg) => pkg.courses.length > 0);

  const admin = await db.appUser.create({
    data: {
      fullName: "JAWRAA Demo Admin",
      email: "admin@jawraa.demo",
      role: UserRole.SUPER_ADMIN,
      department: "Project Office",
      lastLoginAt: new Date(),
    },
  });

  const scopeIds = new Map<string, string>();
  for (const scope of projectScopes) {
    const row = await db.projectScope.create({
      data: {
        id: scope.id,
        code: scope.code,
        name: scope.name,
        description: scope.description,
        plannedCompletion: decimal(28),
        actualCompletion: decimal(24),
        budgetAmount: decimal(scope.budget),
        invoicedAmount: decimal(scope.invoiced),
        collectedAmount: decimal(scope.collected),
      },
    });
    scopeIds.set(scope.code, row.id);
  }

  for (const [index, pkg] of packages.entries()) {
    const scopeCode = index < 2 ? "01" : index < 4 ? "02" : "03";
    await db.package.update({
      where: { id: pkg.id },
      data: { scopeId: scopeIds.get(scopeCode)! },
    });

    for (const [courseIndex, course] of pkg.courses.entries()) {
      await db.projectScopeCourse.create({
        data: {
          scopeId: scopeIds.get(scopeCode)!,
          courseId: course.id,
          sortOrder: index * 100 + courseIndex + 1,
        },
      });
    }
  }

  const providers = new Map<string, string>();
  for (const provider of providerDefinitions) {
    const row = await db.provider.create({
      data: {
        providerType: provider.providerType,
        nameEn: provider.nameEn,
        nameAr: provider.nameAr,
        country: "Saudi Arabia",
        city: provider.city,
        contactPerson: provider.contactPerson,
        email: provider.email,
        phone: provider.phone,
        website: `https://${provider.key}.sa`,
        notes: provider.notes,
      },
    });
    providers.set(provider.key, row.id);
  }

  const trainers = new Map<string, string>();
  for (const definition of trainerDefinitions) {
    const [fullNameEn, fullNameAr, specialization, years, body, nationality, providerKey] = definition;
    const row = await db.trainer.create({
      data: {
        providerId: providers.get(providerKey),
        fullNameEn,
        fullNameAr,
        email: `${fullNameEn.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}@trainer.demo`,
        phone: `+966 5${String(10000000 + trainers.size * 735421).slice(0, 8)}`,
        nationality,
        yearsOfExperience: years,
        isApproved: true,
        approvalDate: toDate("2025-08-20"),
        bio: `${fullNameEn} has ${years} years of experience in ${specialization}.`,
        specialization,
        credentials: {
          create: {
            credentialName: `${body} Certified Trainer`,
            issuingBody: body,
            credentialType: "Professional Certification",
            issueDate: toDate("2022-01-15"),
            expiryDate: toDate("2027-01-15"),
            documentUrl: `/uploads/demo/trainers/${fullNameEn.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-credential.pdf`,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        },
      },
    });
    trainers.set(fullNameEn, row.id);
  }

  const locations = new Map<string, string>();
  for (const [key, city, nameEn, nameAr] of locationDefinitions) {
    const row = await db.location.create({
      data: {
        locationType: LocationType.INTERNAL_VENUE,
        nameEn,
        nameAr,
        country: "Saudi Arabia",
        city,
        venueName: nameEn,
        roomName: "Training Hall",
        address: `${city} - Main Training Venue`,
        timezone: "Asia/Riyadh",
        capacity: 25 + (locations.size % 5),
      },
    });
    locations.set(key, row.id);
  }

  const participants = new Map<string, string>();
  for (const [index, fullName] of participantNames.entries()) {
    const row = await db.participant.create({
      data: {
        participantType: ParticipantType.STUDENT,
        nationalIdOrIqama: `10${String(70000000 + index).padStart(8, "0")}`,
        employeeNumber: `EMP-${String(index + 1).padStart(4, "0")}`,
        fullNameEn: fullName,
        fullNameAr: fullName,
        email: emailFromName(fullName, index + 1),
        phone: `+966 5${String(20000000 + index * 39127).slice(0, 8)}`,
        organizationName: "Client Ministry",
        jobTitle: grades[index % grades.length],
        department: departments[index % departments.length],
        city: locationDefinitions[index % locationDefinitions.length][1],
      },
    });
    participants.set(fullName, row.id);
  }

  const sessionPlan = [
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2025-09-15", "2025-09-19", 20, 20, 19, 4.6],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2025-10-08", "2025-10-10", 22, 21, 20, 4.8],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2025-11-04", "2025-11-05", 18, 17, 15, 4.5],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2025-11-24", "2025-11-26", 20, 18, 16, 4.3],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2025-12-10", "2025-12-12", 24, 22, 21, 4.7],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-01-13", "2026-01-15", 20, 19, 16, 4.2],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-02-03", "2026-02-05", 18, 16, 14, 4.1],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-02-24", "2026-02-26", 22, 20, 18, 4.4],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-03-16", "2026-03-17", 20, 18, 17, 4.6],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-04-06", "2026-04-07", 24, 23, 22, 4.7],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-04-27", "2026-04-28", 20, 19, 18, 4.8],
    [CourseRunStatus.COMPLETED, ApprovalStatus.APPROVED, "2026-05-11", "2026-05-13", 18, 16, 14, 4.0],
    [CourseRunStatus.ONGOING, ApprovalStatus.APPROVED, "2026-05-15", "2026-05-19", 22, 20, 12, 0],
    [CourseRunStatus.ONGOING, ApprovalStatus.APPROVED, "2026-05-16", "2026-05-20", 20, 18, 10, 0],
    [CourseRunStatus.ONGOING, ApprovalStatus.APPROVED, "2026-05-14", "2026-05-18", 18, 16, 9, 0],
    [CourseRunStatus.APPROVAL_PENDING, ApprovalStatus.PENDING, "2026-06-08", "2026-06-12", 24, 14, 0, 0],
    [CourseRunStatus.CONFIRMED, ApprovalStatus.APPROVED, "2026-06-22", "2026-06-24", 22, 18, 0, 0],
    [CourseRunStatus.PLANNED, ApprovalStatus.APPROVED, "2026-07-06", "2026-07-08", 20, 10, 0, 0],
    [CourseRunStatus.APPROVAL_PENDING, ApprovalStatus.PENDING, "2026-07-20", "2026-07-22", 20, 8, 0, 0],
    [CourseRunStatus.CONFIRMED, ApprovalStatus.APPROVED, "2026-08-03", "2026-08-04", 18, 12, 0, 0],
    [CourseRunStatus.APPROVAL_PENDING, ApprovalStatus.PENDING, "2026-08-17", "2026-08-19", 20, 5, 0, 0],
    [CourseRunStatus.PLANNED, ApprovalStatus.REJECTED, "2026-09-07", "2026-09-09", 18, 0, 0, 0],
    [CourseRunStatus.CONFIRMED, ApprovalStatus.APPROVED, "2026-09-21", "2026-09-22", 20, 8, 0, 0],
  ] as const;

  for (const [index, plan] of sessionPlan.entries()) {
    const [status, approvalStatus, start, end, seats, registered, attended, satisfaction] = plan;
    const packageForSession = packagesWithCourses[index % packagesWithCourses.length];
    const course = packageForSession.courses[Math.floor(index / packagesWithCourses.length) % packageForSession.courses.length];
    const fit = courseFit(course.nameEn || course.nameAr);
    const locationKey = locationDefinitions[index % locationDefinitions.length][0];
    const startDate = toDate(start);
    const endDate = toDate(end);
    const run = await db.courseRun.create({
      data: {
        courseId: course.id,
        providerId: providers.get(fit.provider),
        locationId: locations.get(locationKey),
        runCode: `AC-${String(index + 1).padStart(4, "0")}`,
        status,
        deliveryMode: DeliveryMode.IN_PERSON,
        startDate,
        endDate,
        startTime: "09:00",
        endTime: "15:00",
        plannedSeats: seats,
        confirmedSeats: registered,
        attendanceRequired: true,
        certificateRequired: true,
        courseCardStatus: index < 2 ? CourseCardStatus.APPROVED : status === CourseRunStatus.COMPLETED ? CourseCardStatus.SUBMITTED : CourseCardStatus.DRAFT,
        approvalStatus,
        ownerUserId: admin.id,
        notes: approvalStatus === ApprovalStatus.REJECTED ? "Trainer bio not attached - please resubmit" : `${course.nameEn || course.nameAr} scheduled under the project contract.`,
      },
    });

    await db.courseRunTrainer.create({
      data: {
        courseRunId: run.id,
        trainerId: trainers.get(fit.trainer)!,
        role: "Lead trainer",
        isPrimary: true,
      },
    });

    const enrolled = assignedParticipants(index, registered);
    for (const [participantIndex, participantName] of enrolled.entries()) {
      const participantId = participants.get(participantName)!;
      await db.nomination.create({
        data: {
          courseRunId: run.id,
          participantId,
          nominatedByUserId: admin.id,
          nominationStatus: status === CourseRunStatus.PLANNED || status === CourseRunStatus.APPROVAL_PENDING ? NominationStatus.NOMINATED : NominationStatus.CONFIRMED,
          confirmationStatus: status === CourseRunStatus.PLANNED || status === CourseRunStatus.APPROVAL_PENDING ? null : NominationStatus.CONFIRMED,
          confirmedAt: status === CourseRunStatus.PLANNED || status === CourseRunStatus.APPROVAL_PENDING ? null : addDays(startDate, -10),
          notes: "Registered through the project training plan.",
        },
      });

      if (status === CourseRunStatus.COMPLETED || status === CourseRunStatus.ONGOING) {
        const wasPresent = participantIndex < attended;
        await db.attendanceRecord.create({
          data: {
            courseRunId: run.id,
            participantId,
            attendanceDate: status === CourseRunStatus.ONGOING ? toDate("2026-05-16") : startDate,
            checkInTime: wasPresent ? new Date(`${start}T09:03:00.000Z`) : null,
            checkOutTime: wasPresent ? new Date(`${start}T15:02:00.000Z`) : null,
            attendanceStatus: wasPresent ? (participantIndex % 9 === 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT) : AttendanceStatus.ABSENT,
            recordedByUserId: admin.id,
            notes: wasPresent ? "Attended session." : "Absent from the session.",
          },
        });
      }

      if (status === CourseRunStatus.COMPLETED && participantIndex < attended) {
        await db.evaluation.create({
          data: {
            courseRunId: run.id,
            participantId,
            trainerScore: Math.min(5, Math.max(4, Math.round(satisfaction))),
            venueScore: 5,
            contentScore: Math.min(5, Math.max(4, Math.round(satisfaction))),
            operationsScore: 4,
            overallScore: decimal(satisfaction),
            positiveNotes: "The content was practical and linked to current project work.",
            improvementNotes: participantIndex % 4 === 0 ? "Add more local case studies." : null,
            submittedAt: addDays(endDate, 1),
          },
        });
      }
    }

    if (status === CourseRunStatus.COMPLETED) {
      await db.qualityReport.create({
        data: {
          courseRunId: run.id,
          reportStatus: ReportStatus.APPROVED,
          submittedByUserId: admin.id,
          submittedAt: addDays(endDate, 2),
          dueDate: addDays(endDate, 3),
          summary: `${course.nameEn || course.nameAr} completed with ${attended} of ${registered} participants meeting attendance requirements. Satisfaction averaged ${satisfaction.toFixed(1)} out of 5.`,
          satisfactionRate: decimal((satisfaction / 5) * 100),
          issuesFound: attended < registered ? "A small number of participants missed the session." : "No major issues.",
          actionsTaken: "Attendance and feedback were reviewed with the provider.",
        },
      });

      const docs = [
        [DocumentType.ATTENDANCE_SHEET, "Attendance Sheet", "xlsx"],
        [DocumentType.OTHER, "Signed Sign-in List", "pdf"],
        [DocumentType.QUALITY_REPORT, "Trainer Evaluation Form", "pdf"],
        [DocumentType.FINAL_REPORT, "Participant Feedback Summary", "pdf"],
        [DocumentType.CERTIFICATE_TEMPLATE, "Certificate Copies", "pdf"],
      ] as const;

      for (const [docIndex, [documentType, title, extension]] of docs.entries()) {
        await db.document.create({
          data: {
            entityType: DocumentEntityType.COURSE_RUN,
            entityId: run.id,
            documentType,
            title,
            fileName: `${run.runCode.toLowerCase()}-${docIndex + 1}.${extension}`,
            originalFileName: `${run.runCode} - ${title}.${extension}`,
            fileUrl: `/uploads/demo/${run.runCode.toLowerCase()}-${docIndex + 1}.${extension}`,
            storagePath: `demo/${run.runCode.toLowerCase()}-${docIndex + 1}.${extension}`,
            mimeType: extension === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
            fileSizeBytes: extension === "xlsx" ? 184_000 : 420_000 + docIndex * 35_000,
            version: 1,
            contextLabel: `${course.nameEn || course.nameAr} evidence`,
            uploadedByUserId: admin.id,
            uploadedAt: addDays(endDate, 2),
            notes: `${title} for ${course.nameEn || course.nameAr}.`,
          },
        });
      }
    } else if (status === CourseRunStatus.ONGOING) {
      await db.qualityReport.create({
        data: {
          courseRunId: run.id,
          reportStatus: ReportStatus.PENDING,
          dueDate: addDays(endDate, 1),
          summary: "Report deadline is coming after the session closes.",
        },
      });
    }
  }

  for (const pkg of packages) {
    const runs = await db.courseRun.aggregate({
      where: { course: { packageId: pkg.id } },
      _sum: { plannedSeats: true },
    });
    await db.package.update({
      where: { id: pkg.id },
      data: { expectedTraineeCount: runs._sum.plannedSeats ?? 0 },
    });
  }

  const riskRows = [
    ["Low participant registration for Dammam sessions", "Medium probability, High impact, Open"],
    ["Trainer availability conflict in Q2", "Low probability, Medium impact, Open"],
    ["Budget overrun on international certifications", "Medium probability, High impact, Open"],
  ];
  for (const [index, [title, notes]] of riskRows.entries()) {
    await db.document.create({
      data: {
        entityType: DocumentEntityType.RISK,
        entityId: `risk-${index + 1}`,
        documentType: DocumentType.OTHER,
        title,
        fileName: `risk-${index + 1}.txt`,
        originalFileName: `${title}.txt`,
        fileUrl: `/uploads/demo/risk-${index + 1}.txt`,
        mimeType: "text/plain",
        fileSizeBytes: 4_000,
        contextLabel: "Risks Log",
        notes,
      },
    });
  }

  const issueRows = [
    ["PMP session rescheduled due to venue unavailability", "Resolved, closed last month"],
    ["3 participants dropped from Leadership program without replacement", "Open, being handled"],
  ];
  for (const [index, [title, notes]] of issueRows.entries()) {
    await db.document.create({
      data: {
        entityType: DocumentEntityType.ISSUE,
        entityId: `issue-${index + 1}`,
        documentType: DocumentType.OTHER,
        title,
        fileName: `issue-${index + 1}.txt`,
        originalFileName: `${title}.txt`,
        fileUrl: `/uploads/demo/issue-${index + 1}.txt`,
        mimeType: "text/plain",
        fileSizeBytes: 4_000,
        contextLabel: "Issues Log",
        notes,
      },
    });
  }

  console.log("Seed completed using existing courses and packages.");
  console.log({
    scopes: await db.projectScope.count(),
    packages: await db.package.count(),
    courses: await db.course.count(),
    providers: await db.provider.count(),
    trainers: await db.trainer.count(),
    locations: await db.location.count(),
    participants: await db.participant.count(),
    sessions: await db.courseRun.count(),
    completedSessions: await db.courseRun.count({ where: { status: CourseRunStatus.COMPLETED } }),
    activeSessions: await db.courseRun.count({ where: { status: CourseRunStatus.ONGOING } }),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
