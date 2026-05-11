DELETE FROM "Nomination"
WHERE "participantId" IN (
  SELECT id
  FROM "Participant"
  WHERE "fullNameEn" LIKE 'Test Student %'
);

DELETE FROM "Participant"
WHERE "fullNameEn" LIKE 'Test Student %';
