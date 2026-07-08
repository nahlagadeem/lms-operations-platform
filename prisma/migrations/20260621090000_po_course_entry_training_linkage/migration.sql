-- Add PO Course Entry planning data.
ALTER TABLE "ProjectScopeCourse"
ADD COLUMN "estimatedSeats" INTEGER;

-- Add nullable Training links without changing existing records.
ALTER TABLE "CourseRun"
ADD COLUMN "projectScopeId" TEXT,
ADD COLUMN "projectScopeCourseId" TEXT;

CREATE INDEX "CourseRun_projectScopeId_idx" ON "CourseRun"("projectScopeId");
CREATE INDEX "CourseRun_projectScopeCourseId_idx" ON "CourseRun"("projectScopeCourseId");

ALTER TABLE "CourseRun"
ADD CONSTRAINT "CourseRun_projectScopeId_fkey"
FOREIGN KEY ("projectScopeId") REFERENCES "ProjectScope"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseRun"
ADD CONSTRAINT "CourseRun_projectScopeCourseId_fkey"
FOREIGN KEY ("projectScopeCourseId") REFERENCES "ProjectScopeCourse"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
