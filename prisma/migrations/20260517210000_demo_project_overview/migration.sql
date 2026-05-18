CREATE TYPE "ProjectActivityType" AS ENUM ('PREVIOUS', 'CURRENT', 'UPCOMING');

CREATE TABLE "ProjectSummary" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "baselineProgress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualProgress" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalProjectValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalProjectInvoices" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCollectedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remainingUnbilledValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "type" "ProjectActivityType" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRisk" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "impact" TEXT NOT NULL,
    "probability" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "responsePlan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "closureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectIssue" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "owner" TEXT NOT NULL,
    "responsePlan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "closureDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectSummary_singletonKey_key" ON "ProjectSummary"("singletonKey");
CREATE INDEX "ProjectActivity_type_createdAt_idx" ON "ProjectActivity"("type", "createdAt");

INSERT INTO "ProjectSummary" (
    "id",
    "singletonKey",
    "startDate",
    "expectedEndDate",
    "baselineProgress",
    "actualProgress",
    "totalProjectValue",
    "totalProjectInvoices",
    "totalCollectedValue",
    "remainingUnbilledValue",
    "updatedAt"
) VALUES (
    'active-project-summary',
    'ACTIVE',
    '2026-01-01',
    '2026-12-31',
    35,
    28,
    0,
    0,
    0,
    0,
    CURRENT_TIMESTAMP
) ON CONFLICT ("singletonKey") DO NOTHING;
