-- AlterTable
ALTER TABLE "CourseRunDocument"
ADD COLUMN "originalFileName" TEXT,
ADD COLUMN "storagePath" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "fileSizeBytes" INTEGER,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "CourseRunDocument_courseRunId_documentType_idx" ON "CourseRunDocument"("courseRunId", "documentType");
