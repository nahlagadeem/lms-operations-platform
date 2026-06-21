import {
  CourseRunStatus,
  NominationStatus,
  ParticipantType,
  ProviderType,
} from "@prisma/client";
import type {
  AttendanceRecord,
  CourseRun,
  CourseRunDocument,
  CourseRunTrainer,
  Nomination,
  Participant,
  Provider,
  Trainer,
} from "@prisma/client";

// Persistence keeps the original Prisma identifiers to avoid a destructive migration.
// Application and UI code can use these BRD-safe aliases instead.
export type Training = CourseRun;
export type Attendee = Participant;
export type Enrollment = Nomination;
export type Attendance = AttendanceRecord;
export type Vendor = Provider;
export type Instructor = Trainer;
export type TrainingInstructor = CourseRunTrainer;
export type TrainingDocument = CourseRunDocument;

export const TrainingStatus = CourseRunStatus;
export type TrainingStatus = CourseRunStatus;
export const EnrollmentStatus = NominationStatus;
export type EnrollmentStatus = NominationStatus;
export const AttendeeType = ParticipantType;
export type AttendeeType = ParticipantType;
export const VendorType = ProviderType;
export type VendorType = ProviderType;

export function getTrainingBusinessFields(
  training: Pick<CourseRun, "runCode" | "plannedSeats" | "confirmedSeats">,
) {
  return {
    trainingCode: training.runCode,
    estimatedSeats: training.plannedSeats,
    actualSeats: training.confirmedSeats,
  };
}
