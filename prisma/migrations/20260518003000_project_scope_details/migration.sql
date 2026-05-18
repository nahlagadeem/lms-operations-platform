ALTER TABLE "ProjectScope"
ADD COLUMN "nameAr" TEXT,
ADD COLUMN "nameEn" TEXT,
ADD COLUMN "region" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "expectedEndDate" TIMESTAMP(3),
ADD COLUMN "notes" TEXT;

UPDATE "ProjectScope"
SET
  "nameEn" = "name",
  "nameAr" = "name"
WHERE "nameEn" IS NULL AND "nameAr" IS NULL;
