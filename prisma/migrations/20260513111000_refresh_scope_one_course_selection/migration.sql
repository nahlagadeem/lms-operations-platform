DELETE FROM "ProjectScopeCourse"
WHERE "scopeId" = (SELECT id FROM "ProjectScope" WHERE code = '01');

WITH selected_courses AS (
    SELECT id, row_number() OVER (ORDER BY "courseCode") AS sort_order
    FROM "Course"
    WHERE "packageId" = (SELECT id FROM "Package" WHERE code = '01')
    ORDER BY "courseCode"
    LIMIT 5
),
other_ranked_courses AS (
    SELECT
        id,
        row_number() OVER (ORDER BY "courseCode") AS rn
    FROM "Course"
    WHERE "packageId" IN (SELECT id FROM "Package" WHERE code IN ('02', '03', '04', '05'))
),
other_courses AS (
    SELECT id, row_number() OVER (ORDER BY rn) + 5 AS sort_order
    FROM other_ranked_courses
    WHERE (rn - 1) % 17 = 0
    LIMIT 5
),
combined_courses AS (
    SELECT * FROM selected_courses
    UNION ALL
    SELECT * FROM other_courses
)
INSERT INTO "ProjectScopeCourse" ("id", "scopeId", "courseId", "sortOrder")
SELECT
    'scope-01-course-refresh-' || combined_courses.sort_order,
    (SELECT id FROM "ProjectScope" WHERE code = '01'),
    combined_courses.id,
    combined_courses.sort_order
FROM combined_courses
ON CONFLICT ("scopeId", "courseId") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder";
