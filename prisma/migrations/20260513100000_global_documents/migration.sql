CREATE TYPE "DocumentEntityType" AS ENUM (
    'FRAMEWORK_AGREEMENT',
    'SCOPE',
    'PACKAGE',
    'COURSE',
    'COURSE_RUN',
    'PROVIDER',
    'TRAINER',
    'PARTICIPANT',
    'LOCATION',
    'APPROVAL',
    'INVOICE',
    'RISK',
    'ISSUE',
    'REPORT'
);

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "entityType" "DocumentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contextLabel" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");
CREATE INDEX "Document_entityType_entityId_documentType_idx" ON "Document"("entityType", "entityId", "documentType");

ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Document" (
    "id",
    "entityType",
    "entityId",
    "documentType",
    "fileName",
    "originalFileName",
    "fileUrl",
    "storagePath",
    "mimeType",
    "fileSizeBytes",
    "version",
    "contextLabel",
    "uploadedByUserId",
    "uploadedAt",
    "notes"
)
SELECT
    "id",
    'COURSE_RUN'::"DocumentEntityType",
    "courseRunId",
    "documentType",
    "fileName",
    "originalFileName",
    '/api/documents/' || "id",
    "storagePath",
    "mimeType",
    "fileSizeBytes",
    "version",
    'Course run document',
    "uploadedByUserId",
    "uploadedAt",
    "notes"
FROM "CourseRunDocument"
ON CONFLICT ("id") DO NOTHING;
