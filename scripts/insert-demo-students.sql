INSERT INTO "Participant" (
  id,
  "participantType",
  "fullNameAr",
  "fullNameEn",
  email,
  phone,
  "organizationName",
  "jobTitle",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'STUDENT',
  'طالب تجريبي ' || gs::text,
  'Test Student ' || gs::text,
  'test.student' || gs::text || '@demo.local',
  '050000' || lpad(gs::text, 4, '0'),
  'Demo Organization',
  'Trainee',
  true,
  now(),
  now()
FROM generate_series(1, 25) gs
WHERE NOT EXISTS (
  SELECT 1
  FROM "Participant" p
  WHERE p."fullNameEn" = 'Test Student ' || gs::text
);
