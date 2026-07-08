-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "trainingSessionId" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceRecord_trainingSessionId_idx" ON "AttendanceRecord"("trainingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_trainingSessionId_participantId_key" ON "AttendanceRecord"("trainingSessionId", "participantId");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
