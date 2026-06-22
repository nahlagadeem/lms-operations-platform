-- Create enum for training evaluations.
CREATE TYPE "TrainingEvaluationType" AS ENUM ('COURSE', 'INSTRUCTOR', 'ATTENDEE');

-- Create training evaluations table.
CREATE TABLE "TrainingEvaluation" (
    "id" TEXT NOT NULL,
    "courseRunId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "evaluationType" "TrainingEvaluationType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "subjectInstructorId" TEXT,
    "evaluatorInstructorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingEvaluation_pkey" PRIMARY KEY ("id")
);

-- Standard indexes for query patterns.
CREATE INDEX "TrainingEvaluation_courseRunId_evaluationType_idx" ON "TrainingEvaluation"("courseRunId", "evaluationType");
CREATE INDEX "TrainingEvaluation_participantId_evaluationType_idx" ON "TrainingEvaluation"("participantId", "evaluationType");
CREATE INDEX "TrainingEvaluation_subjectInstructorId_idx" ON "TrainingEvaluation"("subjectInstructorId");
CREATE INDEX "TrainingEvaluation_evaluatorInstructorId_idx" ON "TrainingEvaluation"("evaluatorInstructorId");

-- Business-rule checks.
ALTER TABLE "TrainingEvaluation"
  ADD CONSTRAINT "TrainingEvaluation_rating_check"
  CHECK ("rating" >= 1 AND "rating" <= 5);

-- Backward-compatible uniqueness per evaluation shape.
CREATE UNIQUE INDEX "TrainingEvaluation_course_unique"
  ON "TrainingEvaluation"("courseRunId", "participantId")
  WHERE "evaluationType" = 'COURSE';

CREATE UNIQUE INDEX "TrainingEvaluation_instructor_unique"
  ON "TrainingEvaluation"("courseRunId", "participantId", "subjectInstructorId")
  WHERE "evaluationType" = 'INSTRUCTOR' AND "subjectInstructorId" IS NOT NULL;

CREATE UNIQUE INDEX "TrainingEvaluation_attendee_unique"
  ON "TrainingEvaluation"("courseRunId", "participantId", "evaluatorInstructorId")
  WHERE "evaluationType" = 'ATTENDEE' AND "evaluatorInstructorId" IS NOT NULL;

-- Foreign keys.
ALTER TABLE "TrainingEvaluation"
  ADD CONSTRAINT "TrainingEvaluation_courseRunId_fkey"
  FOREIGN KEY ("courseRunId") REFERENCES "CourseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingEvaluation"
  ADD CONSTRAINT "TrainingEvaluation_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingEvaluation"
  ADD CONSTRAINT "TrainingEvaluation_subjectInstructorId_fkey"
  FOREIGN KEY ("subjectInstructorId") REFERENCES "Trainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrainingEvaluation"
  ADD CONSTRAINT "TrainingEvaluation_evaluatorInstructorId_fkey"
  FOREIGN KEY ("evaluatorInstructorId") REFERENCES "Trainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
