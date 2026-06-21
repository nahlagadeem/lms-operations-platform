export {
  assignTrainerToCourseRun as assignInstructorToTraining,
  createCourseRun as createTraining,
  createParticipantAndNominate as createAttendeeAndEnroll,
  nominateExistingParticipant as enrollExistingAttendee,
  recordAttendance,
  removeTrainerFromCourseRun as removeInstructorFromTraining,
  updateCourseRun as updateTraining,
  updateNominationStatus as updateEnrollmentStatus,
} from "@/server/services/course-run-service";
