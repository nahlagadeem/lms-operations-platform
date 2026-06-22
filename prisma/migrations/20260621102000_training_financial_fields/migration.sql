-- CreateEnum
CREATE TYPE "TrainingCity" AS ENUM (
  'RIYADH',
  'JEDDAH',
  'DAMMAM',
  'KHOBAR',
  'MAKKAH',
  'MADINAH',
  'TAIF',
  'ABHA',
  'TABUK',
  'HAIL',
  'JUBAIL',
  'NAJRAN',
  'YANBU'
);

-- AlterTable
ALTER TABLE "CourseRun"
ADD COLUMN "vendorCost" DECIMAL(18,2),
ADD COLUMN "daysHeld" INTEGER,
ADD COLUMN "city" "TrainingCity";
