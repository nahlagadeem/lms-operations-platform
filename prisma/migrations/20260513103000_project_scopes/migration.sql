CREATE TABLE "ProjectScope" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "plannedCompletion" DECIMAL(5,2),
    "actualCompletion" DECIMAL(5,2),
    "budgetAmount" DECIMAL(18,2),
    "invoicedAmount" DECIMAL(18,2),
    "collectedAmount" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectScope_code_key" ON "ProjectScope"("code");

ALTER TABLE "Package" ADD COLUMN "scopeId" TEXT;
CREATE INDEX "Package_scopeId_idx" ON "Package"("scopeId");
ALTER TABLE "Package" ADD CONSTRAINT "Package_scopeId_fkey"
FOREIGN KEY ("scopeId") REFERENCES "ProjectScope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProjectScope" (
    "id",
    "code",
    "name",
    "description",
    "budgetAmount",
    "invoicedAmount",
    "collectedAmount",
    "plannedCompletion",
    "actualCompletion",
    "updatedAt"
)
SELECT
    'scope-' || code,
    code,
    'Scope ' || CAST(code AS INTEGER),
    'Project scope for package ' || code,
    "discountedTotalAmount",
    0,
    0,
    0,
    0,
    CURRENT_TIMESTAMP
FROM "Package"
WHERE code ~ '^[0-9]+$'
ON CONFLICT ("code") DO NOTHING;

UPDATE "Package"
SET "scopeId" = "ProjectScope"."id"
FROM "ProjectScope"
WHERE "ProjectScope"."code" = "Package"."code";
