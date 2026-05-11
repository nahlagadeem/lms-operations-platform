-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('TRAINING', 'CERTIFICATION', 'LANGUAGE', 'CONFERENCE', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('IN_PERSON', 'ONLINE', 'HYBRID', 'ABROAD');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('TRAINING_CENTER', 'UNIVERSITY', 'CERTIFICATION_BODY', 'CONFERENCE_ORGANIZER', 'VENDOR');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('INTERNAL_VENUE', 'EXTERNAL_VENUE', 'ONLINE', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "CourseRunStatus" AS ENUM ('DRAFT', 'PLANNED', 'APPROVAL_PENDING', 'OPEN_FOR_NOMINATION', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELED', 'POSTPONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CourseCardStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('STUDENT', 'TEACHER', 'OWNER', 'COORDINATOR', 'OBSERVER');

-- CreateEnum
CREATE TYPE "NominationStatus" AS ENUM ('NOMINATED', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'REPLACED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "FinalProjectReportType" AS ENUM ('PACKAGE_SUMMARY', 'MONTHLY_OPERATIONS', 'LEADERSHIP_TRACK_SUMMARY', 'FINAL_PROJECT_REPORT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'PROJECT_MANAGER', 'OPERATIONS_COORDINATOR', 'REPORTING_ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('COURSE_CARD', 'PRESENTATION', 'LEARNER_GUIDE', 'ATTENDANCE_SHEET', 'CERTIFICATE_TEMPLATE', 'QUALITY_REPORT', 'FINAL_REPORT', 'PHOTOS_ARCHIVE', 'OTHER');

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "expectedTraineeCount" INTEGER,
    "originalTotalAmount" DECIMAL(18,2),
    "discountedTotalAmount" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,

    CONSTRAINT "CourseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "deliveryType" "DeliveryType" NOT NULL,
    "unitOfMeasure" TEXT,
    "defaultDurationDays" INTEGER,
    "defaultDurationHours" INTEGER,
    "language" TEXT,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
    "requiresProviderRegistration" BOOLEAN NOT NULL DEFAULT false,
    "activeStatus" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePricing" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "originalUnitPriceWithTax" DECIMAL(18,2),
    "originalUnitPriceWithoutTax" DECIMAL(18,2),
    "discountPercentage" DECIMAL(5,4),
    "discountAmount" DECIMAL(18,2),
    "finalUnitPriceWithoutTax" DECIMAL(18,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'SAR',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "country" TEXT,
    "city" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trainer" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "fullNameAr" TEXT NOT NULL,
    "fullNameEn" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "yearsOfExperience" INTEGER,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvalDate" TIMESTAMP(3),
    "bio" TEXT,
    "specialization" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerCredential" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "credentialName" TEXT NOT NULL,
    "issuingBody" TEXT,
    "credentialType" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "locationType" "LocationType" NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "country" TEXT,
    "city" TEXT,
    "branch" TEXT,
    "venueName" TEXT,
    "roomName" TEXT,
    "address" TEXT,
    "mapUrl" TEXT,
    "timezone" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRun" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "providerId" TEXT,
    "locationId" TEXT,
    "runCode" TEXT NOT NULL,
    "status" "CourseRunStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveryMode" "DeliveryMode" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "plannedSeats" INTEGER,
    "confirmedSeats" INTEGER NOT NULL DEFAULT 0,
    "attendanceRequired" BOOLEAN NOT NULL DEFAULT true,
    "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
    "courseCardStatus" "CourseCardStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "ownerUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRunTrainer" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRunTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRunDocument" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CourseRunDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "participantType" "ParticipantType" NOT NULL,
    "nationalIdOrIqama" TEXT,
    "employeeNumber" TEXT,
    "fullNameAr" TEXT NOT NULL,
    "fullNameEn" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "organizationName" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomination" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "nominationStatus" "NominationStatus" NOT NULL DEFAULT 'NOMINATED',
    "nominatedByUserId" TEXT,
    "nominatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmationStatus" "NominationStatus",
    "confirmedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "replacementForNominationId" TEXT,
    "notes" TEXT,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "trainerScore" INTEGER,
    "venueScore" INTEGER,
    "contentScore" INTEGER,
    "operationsScore" INTEGER,
    "overallScore" DECIMAL(5,2),
    "positiveNotes" TEXT,
    "improvementNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityReport" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "reportStatus" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "summary" TEXT,
    "satisfactionRate" DECIMAL(5,2),
    "issuesFound" TEXT,
    "actionsTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalProjectReport" (
    "id" TEXT NOT NULL,
    "reportType" "FinalProjectReportType" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "fileUrl" TEXT,

    CONSTRAINT "FinalProjectReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "oldValuesJson" JSONB,
    "newValuesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Package_code_key" ON "Package"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCategory_code_key" ON "CourseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseCode_key" ON "Course"("courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRun_runCode_key" ON "CourseRun"("runCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRunTrainer_courseRunId_trainerId_key" ON "CourseRunTrainer"("courseRunId", "trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_participantType_nationalIdOrIqama_key" ON "Participant"("participantType", "nationalIdOrIqama");

-- CreateIndex
CREATE UNIQUE INDEX "Nomination_courseRunId_participantId_key" ON "Nomination"("courseRunId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_courseRunId_participantId_attendanceDate_key" ON "AttendanceRecord"("courseRunId", "participantId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_courseRunId_participantId_key" ON "Evaluation"("courseRunId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CourseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePricing" ADD CONSTRAINT "CoursePricing_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerCredential" ADD CONSTRAINT "TrainerCredential_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRun" ADD CONSTRAINT "CourseRun_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRun" ADD CONSTRAINT "CourseRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRun" ADD CONSTRAINT "CourseRun_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRun" ADD CONSTRAINT "CourseRun_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRunTrainer" ADD CONSTRAINT "CourseRunTrainer_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRunTrainer" ADD CONSTRAINT "CourseRunTrainer_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRunDocument" ADD CONSTRAINT "CourseRunDocument_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRunDocument" ADD CONSTRAINT "CourseRunDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_nominatedByUserId_fkey" FOREIGN KEY ("nominatedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_replacementForNominationId_fkey" FOREIGN KEY ("replacementForNominationId") REFERENCES "Nomination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReport" ADD CONSTRAINT "QualityReport_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityReport" ADD CONSTRAINT "QualityReport_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalProjectReport" ADD CONSTRAINT "FinalProjectReport_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
