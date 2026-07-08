-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PROJECT_MANAGER', 'KEY_STAKEHOLDER', 'DATA_ENTRY', 'CUSTOMER');

-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "platformRole" "PlatformRole";
