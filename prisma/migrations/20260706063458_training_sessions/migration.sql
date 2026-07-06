-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSession_courseRunId_idx" ON "TrainingSession"("courseRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_courseRunId_sessionDate_key" ON "TrainingSession"("courseRunId", "sessionDate");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_courseRunId_fkey" FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
