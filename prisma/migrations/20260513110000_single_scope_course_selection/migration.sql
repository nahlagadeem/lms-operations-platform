CREATE TABLE "ProjectScopeCourse" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectScopeCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectScopeCourse_scopeId_courseId_key" ON "ProjectScopeCourse"("scopeId", "courseId");
CREATE INDEX "ProjectScopeCourse_scopeId_sortOrder_idx" ON "ProjectScopeCourse"("scopeId", "sortOrder");
CREATE INDEX "ProjectScopeCourse_courseId_idx" ON "ProjectScopeCourse"("courseId");

ALTER TABLE "ProjectScopeCourse" ADD CONSTRAINT "ProjectScopeCourse_scopeId_fkey"
FOREIGN KEY ("scopeId") REFERENCES "ProjectScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectScopeCourse" ADD CONSTRAINT "ProjectScopeCourse_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "ProjectScope" WHERE code <> '01';

UPDATE "ProjectScope"
SET
    name = 'Scope 1',
    description = 'Current active scope with selected courses from the imported catalog.',
    "plannedCompletion" = 35,
    "actualCompletion" = 22,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE code = '01';

UPDATE "Package"
SET "scopeId" = NULL
WHERE code <> '01';

WITH selected_courses AS (
    SELECT id, row_number() OVER (ORDER BY "courseCode") AS sort_order
    FROM "Course"
    WHERE "packageId" = (SELECT id FROM "Package" WHERE code = '01')
    ORDER BY "courseCode"
    LIMIT 5
),
other_courses AS (
    SELECT id, row_number() OVER (ORDER BY "courseCode") + 5 AS sort_order
    FROM "Course"
    WHERE "packageId" IN (SELECT id FROM "Package" WHERE code IN ('02', '03', '04', '05'))
    ORDER BY "courseCode"
    LIMIT 5
),
combined_courses AS (
    SELECT * FROM selected_courses
    UNION ALL
    SELECT * FROM other_courses
)
INSERT INTO "ProjectScopeCourse" ("id", "scopeId", "courseId", "sortOrder")
SELECT
    'scope-01-course-' || combined_courses.sort_order,
    (SELECT id FROM "ProjectScope" WHERE code = '01'),
    combined_courses.id,
    combined_courses.sort_order
FROM combined_courses
ON CONFLICT ("scopeId", "courseId") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder";
