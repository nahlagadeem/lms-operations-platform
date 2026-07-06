import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEntityType, DocumentType, Prisma, TrainingCity } from "@prisma/client";
import {
  assignInstructorToTraining,
  createAttendeeAndEnroll,
  createTrainingSession,
  enrollExistingAttendee,
  recordAttendance,
  removeInstructorFromTraining,
  upsertAttendeeEvaluation,
  upsertCourseEvaluation,
  upsertInstructorEvaluation,
  updateEnrollmentStatus,
  updateTrainingSession,
  updateTraining,
} from "@/app/course-runs/actions";
import { db } from "@/lib/db";
import { getTrainingBusinessFields } from "@/lib/brd-terminology";
import { getLocale, t } from "@/lib/locale";
import { formatPurchaseOrderCode, formatPurchaseOrderTitle } from "@/lib/purchase-order";
import {
  canEditOperationalData,
  canManageFinancialFields,
  canViewFinancials,
  getCurrentPlatformRole,
  isCustomerCapacityOnly,
} from "@/lib/permissions";
import { getAttendanceRate, getTrainingCapacity } from "@/server/services/capacity-service";
import { getTrainingEnrollmentSummary } from "@/server/services/enrollment-service";
import {
  getAverageCourseRating,
  getAverageInstructorRating,
} from "@/server/services/training-evaluation-service";
import { getTrainingFinancials } from "@/server/services/training-financial-service";

type CourseRunDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    panel?: string;
    attendee?: string;
    status?: string;
  }>;
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatCurrency(
  value: Prisma.Decimal | number | null | undefined,
  locale: string,
  unavailableLabel = "-",
) {
  if (value === null || value === undefined) {
    return unavailableLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatAverageRating(value: number | null, locale: string) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function attendanceCellKey(participantId: string, sessionId: string) {
  return `${participantId}:${sessionId}`;
}

function detailText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      title: "ØªÙØ§ØµÙŠÙ„ Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      description:
        "Ø±Ø§Ø¬Ø¹ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ø§Ù„Ø­Ø§Ù„ÙŠØ©ØŒ Ø«Ù… Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ø£Ø²Ø±Ø§Ø± Ø§Ù„Ø¹Ù„ÙˆÙŠØ© Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ø£Ùˆ Ø¥Ø¶Ø§ÙØ© Ù…Ø¯Ø±Ø¨ Ø£Ùˆ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ØªØ³Ø¬ÙŠÙ„Ø§Øª.",
      edit: "ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      editButton: "ÙØªØ­ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      addTrainer: "Ø¥Ø¶Ø§ÙØ© Ù…Ø¯Ø±Ø¨",
      addTrainerButton: "ÙØªØ­ Ø¥Ø¶Ø§ÙØ© Ù…Ø¯Ø±Ø¨",
      addNomination: "Ø¥Ø¶Ø§ÙØ© ØªØ³Ø¬ÙŠÙ„",
      addNominationButton: "ÙØªØ­ Ø¥Ø¶Ø§ÙØ© ØªØ³Ø¬ÙŠÙ„",
      addAttendance: "ØªØ³Ø¬ÙŠÙ„ Ø­Ø¶ÙˆØ±",
      addAttendanceButton: "ÙØªØ­ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø­Ø¶ÙˆØ±",
      summary: "Ø§Ù„Ù…Ù„Ø®Øµ",
      progress: "Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªÙ‚Ø¯Ù…",
      provider: "Ø§Ù„Ù…ÙˆØ±Ø¯",
      location: "Ø§Ù„Ù…ÙˆÙ‚Ø¹",
      chooseProvider: "Ø§Ø®ØªØ± Ù…ÙˆØ±Ø¯Ø§",
      chooseLocation: "Ø§Ø®ØªØ± Ù…ÙˆÙ‚Ø¹",
      save: "Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª",
      back: "Ø§Ù„Ø¹ÙˆØ¯Ø©",
      notAssigned: "ØºÙŠØ± Ù…Ø³Ù†Ø¯ Ø¨Ø¹Ø¯",
      noNotes: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù„Ø§Ø­Ø¸Ø§Øª",
      trainerAssignments: "Ø¥Ø³Ù†Ø§Ø¯Ø§Øª Ø§Ù„Ù…Ø¯Ø±Ø¨ÙŠÙ†",
      currentTrainers: "Ø§Ù„Ù…Ø¯Ø±Ø¨ÙˆÙ† Ø§Ù„Ø­Ø§Ù„ÙŠÙˆÙ†",
      chooseTrainer: "Ø§Ø®ØªØ± Ù…Ø¯Ø±Ø¨",
      trainerRole: "Ø¯ÙˆØ± Ø§Ù„Ù…Ø¯Ø±Ø¨",
      trainerRolePlaceholder: "Ù…Ø¯Ø±Ø¨ Ø±Ø¦ÙŠØ³ÙŠ Ø£Ùˆ Ù…Ø³Ø§Ø¹Ø¯",
      primaryTrainer: "Ù…Ø¯Ø±Ø¨ Ø±Ø¦ÙŠØ³ÙŠ",
      noTrainers: "Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø¯Ø±Ø¨ÙˆÙ† Ù…Ø³Ù†Ø¯ÙˆÙ† Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†",
      remove: "Ø¥Ø²Ø§Ù„Ø©",
      nominations: "Ø§Ù„ØªØ³Ø¬ÙŠÙ„Ø§Øª",
      currentNominations: "Ø§Ù„ØªØ³Ø¬ÙŠÙ„Ø§Øª Ø§Ù„Ø­Ø§Ù„ÙŠØ©",
      chooseParticipant: "Ø§Ø®ØªØ± Ø£Ø­Ø¯ Ø§Ù„Ø­Ø¶ÙˆØ±",
      nominationStatus: "Ø­Ø§Ù„Ø© Ø§Ù„ØªØ³Ø¬ÙŠÙ„",
      participantType: "Ù†ÙˆØ¹ Ø§Ù„Ø­Ø¶ÙˆØ±",
      participantNameAr: "Ø§Ù„Ø§Ø³Ù… Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©",
      participantNameEn: "Ø§Ù„Ø§Ø³Ù… Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©",
      participantEmail: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      participantPhone: "Ø§Ù„Ø¬ÙˆØ§Ù„",
      participantOrg: "Ø§Ù„Ø¬Ù‡Ø©",
      participantJobTitle: "Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ",
      participantNationalId: "Ø±Ù‚Ù… Ø§Ù„Ù‡ÙˆÙŠØ© / Ø§Ù„Ø¥Ù‚Ø§Ù…Ø©",
      existingParticipant: "ØªØ³Ø¬ÙŠÙ„ Ø­Ø¶ÙˆØ± Ù…ÙˆØ¬ÙˆØ¯",
      quickCreateParticipant: "Ø¥Ø¶Ø§ÙØ© Ø­Ø¶ÙˆØ± Ø¬Ø¯ÙŠØ¯ ÙˆØªØ³Ø¬ÙŠÙ„Ù‡",
      noNominations: "Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ³Ø¬ÙŠÙ„Ø§Øª Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†",
      saveNomination: "Ø­ÙØ¸ Ø§Ù„ØªØ³Ø¬ÙŠÙ„",
      createAndNominate: "Ø¥Ø¶Ø§ÙØ© ÙˆØªØ³Ø¬ÙŠÙ„",
      attendance: "Ø§Ù„Ø­Ø¶ÙˆØ±",
      attendanceLog: "Ø³Ø¬Ù„ Ø§Ù„Ø­Ø¶ÙˆØ±",
      noAttendance: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ø¬Ù„Ø§Øª Ø­Ø¶ÙˆØ± Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†",
      addEnrollmentsBeforeAttendance: "Ø£Ø¶Ù Ø§Ù„Ø­Ø¶ÙˆØ± Ø¥Ù„Ù‰ Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ù‚Ø¨Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø­Ø¶ÙˆØ±.",
      notRecorded: "Ù„Ù… ÙŠØ³Ø¬Ù„",
      attendanceDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø­Ø¶ÙˆØ±",
      attendanceStatus: "Ø­Ø§Ù„Ø© Ø§Ù„Ø­Ø¶ÙˆØ±",
      chooseAttendee: "Ø§Ø®ØªØ± Ù…Ù† Ø§Ù„Ø­Ø¶ÙˆØ± Ø§Ù„Ù…Ø³Ø¬Ù„ÙŠÙ†",
      chooseSession: "Ø§Ø®ØªØ± Ø¬Ù„Ø³Ø©",
      saveAttendance: "Ø­ÙØ¸ Ø§Ù„Ø­Ø¶ÙˆØ±",
      recordedAttendance: "Ø§Ù„Ø­Ø¶ÙˆØ± Ø§Ù„Ù…Ø³Ø¬Ù„",
      completion: "Ø§Ù„Ø§ÙƒØªÙ…Ø§Ù„ ÙˆØ§Ù„Ø£Ù‡Ù„ÙŠØ©",
      completionSummary: "Ù…Ù„Ø®Øµ Ø§Ù„Ø§ÙƒØªÙ…Ø§Ù„",
      noCompletionData: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø­Ø¶ÙˆØ± ÙƒØ§ÙÙŠØ© Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„Ø§ÙƒØªÙ…Ø§Ù„ Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†",
      attendanceRate: "Ù†Ø³Ø¨Ø© Ø§Ù„Ø­Ø¶ÙˆØ±",
      attendedDays: "Ø£ÙŠØ§Ù… Ø§Ù„Ø­Ø¶ÙˆØ±",
      totalSessions: "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¬Ù„Ø³Ø§Øª",
      completionEligible: "Ù…Ø¤Ù‡Ù„ Ù„Ù„Ø§ÙƒØªÙ…Ø§Ù„",
      certificateEligible: "Ù…Ø¤Ù‡Ù„ Ù„Ù„Ø´Ù‡Ø§Ø¯Ø©",
      completionRule: "ÙŠØ¹ØªØ¨Ø± Ø§Ù„Ø­Ø§Ø¶Ø± Ù…Ø¤Ù‡Ù„Ø§Ù‹ Ø¹Ù†Ø¯ Ø­Ø¶ÙˆØ± 75% Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„ Ù…Ù† Ø§Ù„Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ù…Ø³Ø¬Ù„Ø©.",
      eligibleCount: "Ø§Ù„Ø­Ø¶ÙˆØ± Ø§Ù„Ù…Ø¤Ù‡Ù„ÙˆÙ†",
      sessions: "Ø§Ù„Ø¬Ù„Ø³Ø§Øª",
      sessionSchedule: "Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø¬Ù„Ø³Ø§Øª",
      sessionDescription: "Ø£Ø¶Ù Ø£Ùˆ Ø¹Ø¯Ù„ Ø£ÙŠØ§Ù… Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ø¯ÙˆÙ† ØªØºÙŠÙŠØ± Ø­Ø§Ù„Ø© Ø§Ù„ØªØ¯Ø±ÙŠØ¨.",
      sessionDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¬Ù„Ø³Ø©",
      sessionNotes: "Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø¬Ù„Ø³Ø©",
      addSession: "Ø¥Ø¶Ø§ÙØ© Ø¬Ù„Ø³Ø©",
      editSession: "ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø¬Ù„Ø³Ø©",
      saveSession: "Ø­ÙØ¸ Ø§Ù„Ø¬Ù„Ø³Ø©",
      noSessions: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¬Ù„Ø³Ø§Øª Ù…Ø¶Ø§ÙØ© Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†.",
      addSessionsBeforeAttendance: "Ø£Ø¶Ù Ø¬Ù„Ø³Ø§Øª Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ø£ÙˆÙ„Ø§ Ù‚Ø¨Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø­Ø¶ÙˆØ±.",
      threshold: "Ø­Ø¯ Ø§Ù„Ø§ÙƒØªÙ…Ø§Ù„",
      capacityTitle: "Ø³Ø¹Ø© Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      capacityDescription: "Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯ Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ÙŠØ© Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯ Ø§Ù„Ù…Ø¤ÙƒØ¯Ø© Ù„Ù‡Ø°Ø§ Ø§Ù„ØªØ¯Ø±ÙŠØ¨.",
      utilizationPct: "Ù†Ø³Ø¨Ø© Ø§Ù„Ø§Ø³ØªØºÙ„Ø§Ù„ %",
      remainingCapacity: "Ø§Ù„Ø³Ø¹Ø© Ø§Ù„Ù…ØªØ¨Ù‚ÙŠØ©",
      fullyBooked: "Ù…Ø­Ø¬ÙˆØ² Ø¨Ø§Ù„ÙƒØ§Ù…Ù„",
      overCapacityBy: "Ø§Ù„ØªØ¬Ø§ÙˆØ² Ø¨Ù…Ù‚Ø¯Ø§Ø±",
      financialTitle: "Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ù…Ø§Ù„ÙŠØ©",
      financialDescription: "Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯ ÙˆØªÙƒÙ„ÙØ© Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆÙ‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­ Ù„Ù‡Ø°Ø§ Ø§Ù„ØªØ¯Ø±ÙŠØ¨.",
      vendorCost: "ØªÙƒÙ„ÙØ© Ø§Ù„Ù…ÙˆØ±Ø¯",
      revenue: "Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯",
      grossMargin: "Ù‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­",
      marginPct: "Ù‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­ %",
      documents: "Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      documentVault: "Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      documentVaultDescription: "Ø§Ø±ÙØ¹ ÙˆØ§Ø­ÙØ¸ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù…ØªØ¹Ù„Ù‚Ø© Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„ØªØ¯Ø±ÙŠØ¨ÙŠ Ø§Ù„Ø¬Ø§Ø±ÙŠ Ù…Ø«Ù„ Ø§Ù„Ø­Ø¶ÙˆØ± ÙˆØ§Ù„ØªÙ‚Ø§Ø±ÙŠØ± ÙˆØ§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª ÙˆØ§Ù„ØµÙˆØ±.",
      documentType: "Ù†ÙˆØ¹ Ø§Ù„Ù…Ø³ØªÙ†Ø¯",
      documentFile: "Ø§Ù„Ù…Ù„Ù",
      documentNotes: "ÙˆØµÙ Ø£Ùˆ Ù…Ù„Ø§Ø­Ø¸Ø§Øª",
      uploadDocument: "Ø±ÙØ¹ Ø§Ù„Ù…Ø³ØªÙ†Ø¯",
      noDocuments: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ù…Ø±ÙÙˆØ¹Ø© Ù„Ù‡Ø°Ø§ Ø§Ù„ØªØ¯Ø±ÙŠØ¨ Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†",
      download: "ØªØ­Ù…ÙŠÙ„",
      fileSize: "Ø­Ø¬Ù… Ø§Ù„Ù…Ù„Ù",
      version: "Ø§Ù„Ø¥ØµØ¯Ø§Ø±",
      attendanceRequired: "ÙŠØªØ·Ù„Ø¨ Ø­Ø¶ÙˆØ±",
      certificateRequired: "ÙŠØªØ·Ù„Ø¨ Ø´Ù‡Ø§Ø¯Ø©",
      confirmedSeats: "Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯ Ø§Ù„ÙØ¹Ù„ÙŠØ©",
      vendor: "Ø§Ù„Ù…ÙˆØ±Ø¯",
      city: "Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©",
      selectCity: "Ø§Ø®ØªØ± Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©",
      daysHeld: "Ø£ÙŠØ§Ù… Ø§Ù„ØªØ¹Ø§Ù‚Ø¯",
      yes: "Ù†Ø¹Ù…",
      no: "Ù„Ø§",
      close: "Ø¥ØºÙ„Ø§Ù‚",
      plannedSeats: "Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯ Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ÙŠØ©",
      courseStatus: "Ø­Ø§Ù„Ø© Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      enrollmentDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ³Ø¬ÙŠÙ„",
      notes: "Ù…Ù„Ø§Ø­Ø¸Ø§Øª",
      filterAttendee: "ØªØµÙÙŠØ© Ø­Ø³Ø¨ Ø§Ù„Ø­Ø¶ÙˆØ±",
      filterEnrollmentStatus: "ØªØµÙÙŠØ© Ø­Ø³Ø¨ Ø­Ø§Ù„Ø© Ø§Ù„ØªØ³Ø¬ÙŠÙ„",
      allEnrollmentStatuses: "Ø¬Ù…ÙŠØ¹ Ø­Ø§Ù„Ø§Øª Ø§Ù„ØªØ³Ø¬ÙŠÙ„",
      totalEnrollments: "Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ØªØ³Ø¬ÙŠÙ„Ø§Øª",
      confirmedEnrollments: "Ø§Ù„Ù…Ø¤ÙƒØ¯Ø©",
      cancelledEnrollments: "Ø§Ù„Ù…Ù„ØºØ§Ø©",
      completedEnrollments: "Ø§Ù„Ù…ÙƒØªÙ…Ù„Ø©",
      completionRate: "Ù†Ø³Ø¨Ø© Ø§Ù„Ø¥ÙƒÙ…Ø§Ù„ %",
      evaluationTitle: "ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø§Ù„ØªØ¯Ø±ÙŠØ¨",
      evaluationDescription: "Ù‚Ù… Ø¨ØªØ³Ø¬ÙŠÙ„ ØªÙ‚ÙŠÙŠÙ… Ù„Ù„Ø¯ÙˆØ±Ø© Ø£Ùˆ Ø§Ù„Ù…Ø¯Ø±Ø¨ Ø£Ùˆ Ø§Ù„Ù…ØªØ¯Ø±Ø¨.",
      courseEvaluation: "ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø¯ÙˆØ±Ø©",
      instructorEvaluation: "ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…Ø¯Ø±Ø¨",
      attendeeEvaluation: "ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…ØªØ¯Ø±Ø¨",
      rating: "Ø§Ù„ØªÙ‚ÙŠÙŠÙ…",
      comments: "Ø§Ù„ØªØ¹Ù„ÙŠÙ‚Ø§Øª",
      averageCourseRating: "Ù…ØªÙˆØ³Ø· ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø¯ÙˆØ±Ø©",
      averageInstructorRating: "Ù…ØªÙˆØ³Ø· ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…Ø¯Ø±Ø¨",
    };
  }

  return {
    title: "Training Details",
    description:
      "Review the current training information, then use the top actions to edit the training, add an instructor, or manage enrollments.",
    edit: "Edit Training",
    editButton: "Edit Training",
    addTrainer: "Add Instructor",
    addTrainerButton: "Add Instructor",
    addNomination: "Add Enrollment",
    addNominationButton: "Add Enrollment",
    addAttendance: "Add Attendance",
    addAttendanceButton: "Add Attendance",
    summary: "Summary",
    progress: "Progress indicators",
    provider: "Vendor",
    location: "Location",
    chooseProvider: "Choose a vendor",
    chooseLocation: "Choose a location",
    save: "Save Changes",
    back: "Back",
    notAssigned: "Not assigned yet",
    noNotes: "No notes provided",
    trainerAssignments: "Instructor assignments",
    currentTrainers: "Current instructors",
    chooseTrainer: "Choose an instructor",
    trainerRole: "Instructor role",
    trainerRolePlaceholder: "Lead instructor or supporting instructor",
    primaryTrainer: "Primary instructor",
    noTrainers: "No instructors are assigned yet",
    remove: "Remove",
    nominations: "Enrollments",
    currentNominations: "Current Enrollments",
    chooseParticipant: "Choose an attendee",
    nominationStatus: "Enrollment status",
    participantType: "Attendee type",
    participantNameAr: "Arabic name",
    participantNameEn: "English name",
    participantEmail: "Email",
    participantPhone: "Phone number",
    participantOrg: "Organization",
    participantJobTitle: "Job title",
    participantNationalId: "National ID / Iqama",
    existingParticipant: "Enroll an existing attendee",
    quickCreateParticipant: "Add a new attendee and enroll",
    noNominations: "No attendees are enrolled yet. Click Add Enrollment to get started.",
    saveNomination: "Save Enrollment",
    createAndNominate: "Add and Enroll",
    attendance: "Attendance",
    attendanceLog: "Attendance log",
    noAttendance: "No attendance entries have been added yet. Click Add Attendance to get started.",
    addEnrollmentsBeforeAttendance: "Enroll attendees before recording attendance.",
    notRecorded: "Not recorded",
    attendanceDate: "Attendance date",
    attendanceStatus: "Attendance status",
    chooseAttendee: "Choose an enrolled attendee",
    chooseSession: "Choose a session",
    saveAttendance: "Save attendance",
    recordedAttendance: "Attendance entries",
    evaluationTitle: "Training evaluations",
    evaluationDescription: "Record internal course, instructor, and attendee evaluations.",
    courseEvaluation: "Course evaluation",
    instructorEvaluation: "Instructor evaluation",
    attendeeEvaluation: "Attendee evaluation",
    rating: "Rating",
    comments: "Comments",
    averageCourseRating: "Average Course Rating",
    averageInstructorRating: "Average Instructor Rating",
    completion: "Completion and eligibility",
    completionSummary: "Completion summary",
    noCompletionData: "There is not enough attendance data to calculate completion yet",
    attendanceRate: "Attendance rate",
    attendedDays: "Attended days",
    totalSessions: "Total sessions",
    completionEligible: "Completion eligible",
    certificateEligible: "Ready to issue certificate",
    completionRule: "An attendee is ready to complete the training after attending at least 75% of its sessions.",
    eligibleCount: "Eligible attendees",
    sessions: "Sessions",
    sessionSchedule: "Session schedule",
    sessionDescription: "Add or edit training days without changing the training lifecycle status.",
    sessionDate: "Session date",
    sessionNotes: "Session notes",
    addSession: "Add Session",
    editSession: "Edit Session",
    saveSession: "Save Session",
    noSessions: "No sessions have been added yet.",
    addSessionsBeforeAttendance: "Add training sessions before recording attendance.",
      threshold: "Completion threshold",
      capacityTitle: "Training Capacity",
      capacityDescription: "Estimated seats versus actual confirmed seats for this training.",
      utilizationPct: "Utilization %",
      remainingCapacity: "Remaining Capacity",
      fullyBooked: "Fully Booked",
      overCapacityBy: "Over Capacity by",
      financialTitle: "Financial Indicators",
      financialDescription: "Revenue, vendor cost, and gross margin for this training.",
      vendorCost: "Vendor Cost",
      revenue: "Revenue",
      grossMargin: "Gross Margin",
      marginPct: "Margin %",
      documents: "Documents",
    documentVault: "Documents",
    documentVaultDescription: "Upload training files such as attendance sheets, reports, certificates, and photos.",
    documentType: "Document type",
    documentFile: "File",
    documentNotes: "Description or notes",
    uploadDocument: "Upload File",
    noDocuments: "No files have been uploaded for this training yet.",
    download: "Download",
    fileSize: "File size",
    version: "Version",
    attendanceRequired: "Attendance required",
    certificateRequired: "Issue certificate",
    confirmedSeats: "Actual Seats",
    vendor: "Vendor",
    city: "City",
    selectCity: "Select a city",
    daysHeld: "Days Held",
    yes: "Yes",
    no: "No",
    close: "Close",
    plannedSeats: "Estimated Seats",
    courseStatus: "Training Status",
    enrollmentDate: "Enrollment Date",
    notes: "Notes",
    filterAttendee: "Filter by attendee",
    filterEnrollmentStatus: "Filter by enrollment status",
    allEnrollmentStatuses: "All enrollment statuses",
    totalEnrollments: "Total Enrollments",
    confirmedEnrollments: "Confirmed",
    cancelledEnrollments: "Cancelled",
    completedEnrollments: "Completed",
    completionRate: "Completion Rate %",
  };
}

function enrollmentStatusText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      NOMINATED: "Ù‚ÙŠØ¯ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±",
      CONFIRMED: "Ù…Ø¤ÙƒØ¯",
      DECLINED: "Ù…Ù„ØºÙ‰",
      WITHDRAWN: "Ù…ÙƒØªÙ…Ù„",
    } as const;
  }

  return {
    NOMINATED: "Pending",
    CONFIRMED: "Confirmed",
    DECLINED: "Cancelled",
    WITHDRAWN: "Completed",
  } as const;
}

function getEnrollmentDisplayStatus(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "DECLINED":
    case "REPLACED":
      return "CANCELLED";
    case "WITHDRAWN":
      return "COMPLETED";
    default:
      return "PENDING";
  }
}

function getEnrollmentEditValue(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "DECLINED":
    case "REPLACED":
      return "DECLINED";
    case "WITHDRAWN":
      return "WITHDRAWN";
    default:
      return "NOMINATED";
  }
}

function getEnrollmentStatusLabel(locale: "en" | "ar", status: string) {
  const labels = enrollmentStatusText(locale);
  const displayStatus = getEnrollmentDisplayStatus(status);

  if (displayStatus === "CONFIRMED") return labels.CONFIRMED;
  if (displayStatus === "CANCELLED") return labels.DECLINED;
  if (displayStatus === "COMPLETED") return labels.WITHDRAWN;
  return labels.NOMINATED;
}

function participantTypeText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      STUDENT: "Ù…ØªØ¯Ø±Ø¨",
      TEACHER: "Ù…Ø¯Ø±Ø¨",
      OWNER: "Ù…Ø§Ù„Ùƒ",
      COORDINATOR: "Ù…Ù†Ø³Ù‚",
      OBSERVER: "Ù…Ø±Ø§Ù‚Ø¨",
    } as const;
  }

  return {
    STUDENT: "Attendee",
    TEACHER: "Teacher",
    OWNER: "Owner",
    COORDINATOR: "Coordinator",
    OBSERVER: "Observer",
  } as const;
}

function attendanceStatusText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      PRESENT: "Ø­Ø§Ø¶Ø±",
      ABSENT: "ØºØ§Ø¦Ø¨",
      LATE: "Ù…ØªØ£Ø®Ø±",
      EXCUSED: "Ø¨Ø¹Ø°Ø±",
      PARTIAL: "Ø­Ø¶ÙˆØ± Ø¬Ø²Ø¦ÙŠ",
    } as const;
  }

  return {
    PRESENT: "Present",
    ABSENT: "Absent",
    LATE: "Late",
    EXCUSED: "Excused",
    PARTIAL: "Partial",
  } as const;
}

function documentTypeText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      COURSE_CARD: "Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¯ÙˆØ±Ø©",
      PRESENTATION: "Ø¹Ø±Ø¶ ØªÙ‚Ø¯ÙŠÙ…ÙŠ",
      LEARNER_GUIDE: "Ø¯Ù„ÙŠÙ„ Ø§Ù„Ù…ØªØ¯Ø±Ø¨",
      ATTENDANCE_SHEET: "ÙƒØ´Ù Ø§Ù„Ø­Ø¶ÙˆØ±",
      CERTIFICATE_TEMPLATE: "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø´Ù‡Ø§Ø¯Ø©",
      QUALITY_REPORT: "ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¬ÙˆØ¯Ø©",
      FINAL_REPORT: "Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      PHOTOS_ARCHIVE: "Ø£Ø±Ø´ÙŠÙ Ø§Ù„ØµÙˆØ±",
      OTHER: "Ø£Ø®Ø±Ù‰",
    } as Record<DocumentType, string>;
  }

  return {
    COURSE_CARD: "Course card",
    PRESENTATION: "Presentation",
    LEARNER_GUIDE: "Learner guide",
    ATTENDANCE_SHEET: "Attendance sheet",
    CERTIFICATE_TEMPLATE: "Certificate template",
    QUALITY_REPORT: "Course report",
    FINAL_REPORT: "Final report",
    PHOTOS_ARCHIVE: "Photos archive",
    OTHER: "Other",
  } as Record<DocumentType, string>;
}

function formatFileSize(bytes: number | null, locale: string) {
  if (!bytes) {
    return "-";
  }

  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

function panelHref(id: string, panel: "edit" | "instructor" | "enrollment") {
  return `/trainings/${id}?panel=${panel}`;
}

export default async function CourseRunDetailPage({
  params,
  searchParams,
}: CourseRunDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const enrollmentSearch = (query.attendee ?? "").trim().toLowerCase();
  const enrollmentStatusFilter = (query.status ?? "").trim();
  const openPanel =
    query.panel === "edit" ||
    query.panel === "instructor" ||
    query.panel === "enrollment"
      ? query.panel
      : "";
  const locale = await getLocale();
  const localeText = t(locale);
  const details = detailText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const completionThreshold = 0.75;
  const platformRole = await getCurrentPlatformRole();
  const canEditOps = canEditOperationalData(platformRole);
  const canManageFinancials = canManageFinancialFields(platformRole);
  const canSeeFinancials = canViewFinancials(platformRole);
  const customerOnly = isCustomerCapacityOnly(platformRole);

  const [
    run,
    documents,
    providers,
    locations,
    trainers,
    participants,
    purchaseOrderCourseEntries,
    enrollmentSummary,
  ] = await Promise.all([
    db.courseRun.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            package: true,
            category: true,
          },
        },
        projectScope: true,
        projectScopeCourse: {
          include: { course: true },
        },
        provider: true,
        location: true,
        trainers: {
          include: {
            trainer: true,
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        nominations: {
          include: {
            participant: true,
          },
          orderBy: [{ nominatedAt: "desc" }],
        },
        attendanceRecords: {
          include: {
            participant: true,
          },
          orderBy: [{ attendanceDate: "desc" }, { recordedAt: "desc" }],
        },
        sessions: {
          orderBy: { sessionDate: "asc" },
        },
        _count: {
          select: {
            nominations: true,
            attendanceRecords: true,
          },
        },
      },
    }),
    db.document.findMany({
      where: {
        entityType: DocumentEntityType.COURSE_RUN,
        entityId: id,
      },
      orderBy: [{ uploadedAt: "desc" }],
    }),
    db.provider.findMany({
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    }),
    db.location.findMany({
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    }),
    db.trainer.findMany({
      select: {
        id: true,
        fullNameAr: true,
        fullNameEn: true,
        specialization: true,
      },
      orderBy: { fullNameAr: "asc" },
    }),
    db.participant.findMany({
      select: {
        id: true,
        fullNameAr: true,
        fullNameEn: true,
        email: true,
        participantType: true,
      },
      orderBy: { fullNameAr: "asc" },
      take: 300,
    }),
    db.projectScopeCourse.findMany({
      include: { scope: true, course: true },
      orderBy: [{ scope: { code: "asc" } }, { sortOrder: "asc" }],
    }),
    getTrainingEnrollmentSummary(id),
  ]);

  if (!run) notFound();

  const training = getTrainingBusinessFields(run);
  const [trainingFinancials, averageCourseRating, averageInstructorRating] = await Promise.all([
    getTrainingFinancials(run.id),
    getAverageCourseRating(run.id),
    getAverageInstructorRating(run.id),
  ]);
  const trainingCapacity = getTrainingCapacity({
    plannedSeats: run.plannedSeats,
    confirmedSeats: run.confirmedSeats,
  });
  const attendanceSummary = await getAttendanceRate(run.id);
  const totalSessionCount = run.sessions.length;

  const attendanceByParticipant = new Map<
    string,
    {
      participantId: string;
      participantName: string;
      presentCount: number;
      totalSessions: number;
      attendanceRate: number;
      completionEligible: boolean;
      certificateEligible: boolean;
    }
  >();

  for (const record of run.attendanceRecords) {
    const participantId = record.participantId;
    const existing = attendanceByParticipant.get(participantId) ?? {
      participantId,
      participantName: record.participant.fullNameEn || record.participant.fullNameAr,
      presentCount: 0,
      totalSessions: totalSessionCount,
      attendanceRate: 0,
      completionEligible: false,
      certificateEligible: false,
    };

    if (record.attendanceStatus === "PRESENT" || record.attendanceStatus === "PARTIAL") {
      existing.presentCount += 1;
    }

    attendanceByParticipant.set(participantId, existing);
  }

  const completionRows = Array.from(attendanceByParticipant.values())
    .map((item) => {
      const attendanceRate =
        item.totalSessions > 0 ? item.presentCount / item.totalSessions : 0;
      const completionEligible = attendanceRate >= completionThreshold;
      const certificateEligible =
        run.certificateRequired && completionEligible ? true : !run.certificateRequired;

      return {
        ...item,
        attendanceRate,
        completionEligible,
        certificateEligible,
      };
    })
    .sort((left, right) => right.attendanceRate - left.attendanceRate);

  const eligibleCount = completionRows.filter((item) => item.completionEligible).length;
  const latestAttendanceByParticipant = new Map<
    string,
    (typeof run.attendanceRecords)[number]
  >();

  for (const record of run.attendanceRecords) {
    if (!latestAttendanceByParticipant.has(record.participantId)) {
      latestAttendanceByParticipant.set(record.participantId, record);
    }
  }

  const filteredEnrollments = run.nominations.filter((nomination) => {
    const status = getEnrollmentDisplayStatus(nomination.nominationStatus);
    const participantSearch = [
      nomination.participant.fullNameAr,
      nomination.participant.fullNameEn,
      nomination.participant.email,
      nomination.participant.organizationName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const attendeeMatches = !enrollmentSearch || participantSearch.includes(enrollmentSearch);
    const statusMatches =
      !enrollmentStatusFilter || enrollmentStatusFilter === status;

    return attendeeMatches && statusMatches;
  });

  const attendanceSessionIdByDate = new Map(
    run.sessions.map((session) => [dateKey(session.sessionDate), session.id]),
  );
  const attendanceByCell = new Map<string, (typeof run.attendanceRecords)[number]>();

  for (const record of run.attendanceRecords) {
    const sessionId =
      record.trainingSessionId ?? attendanceSessionIdByDate.get(dateKey(record.attendanceDate));

    if (!sessionId) {
      continue;
    }

    const cellKey = attendanceCellKey(record.participantId, sessionId);
    if (!attendanceByCell.has(cellKey)) {
      attendanceByCell.set(cellKey, record);
    }
  }

  const attendanceGridEnrollments = run.nominations.filter((nomination) => {
    const status = getEnrollmentDisplayStatus(nomination.nominationStatus);
    return status === "PENDING" || status === "CONFIRMED";
  });

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/trainings"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">â†</span>
              <span>{details.back}</span>
            </Link>
            <p className="eyebrow">{details.title}</p>
            <h2 className="section-title">
              {training.trainingCode} | {run.course.nameEn || run.course.nameAr}
            </h2>
            <p className="section-copy">{details.description}</p>
          </div>

          {canEditOps ? (
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <Link href={panelHref(run.id, "edit")} className="primary-button min-w-fit whitespace-nowrap px-4 text-center text-sm">
                {details.edit}
              </Link>
              <Link
                href={panelHref(run.id, "instructor")}
                className="secondary-button min-w-fit whitespace-nowrap px-4 text-center text-sm"
              >
                {details.addTrainer}
              </Link>
              <Link
                href={panelHref(run.id, "enrollment")}
                className="secondary-button min-w-fit whitespace-nowrap px-4 text-center text-sm"
              >
                {details.addNomination}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6 min-w-0">
          <div className="panel-surface">
            <p className="eyebrow">{details.summary}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label={localeText.courseRuns.packageName}
                value={run.course.package.nameEn || run.course.package.nameAr}
              />
              <InfoCard
                label={localeText.courses.category}
                value={run.course.category.nameEn || run.course.category.nameAr}
              />
              <InfoCard
                label={localeText.courseRuns.course}
                value={`${run.course.courseCode} | ${run.course.nameEn || run.course.nameAr}`}
              />
              <InfoCard
                label={localeText.courseRuns.purchaseOrder}
                value={
                  run.projectScope
                    ? `${formatPurchaseOrderCode(run.projectScope.code, locale)} | ${formatPurchaseOrderTitle(run.projectScope, locale)}`
                    : details.notAssigned
                }
              />
              <InfoCard
                label={localeText.courseRuns.purchaseOrderCourseEntry}
                value={
                  run.projectScopeCourse
                    ? `${run.projectScopeCourse.course.courseCode} | ${run.projectScopeCourse.course.nameEn || run.projectScopeCourse.course.nameAr}`
                    : details.notAssigned
                }
              />
              <InfoCard
                label={localeText.courseRuns.mode}
                value={localeText.deliveryModes[run.deliveryMode]}
              />
              <InfoCard
                label={details.provider}
                value={run.provider?.nameEn || run.provider?.nameAr || details.notAssigned}
              />
              <InfoCard
                label={details.location}
                value={run.location?.nameEn || run.location?.nameAr || details.notAssigned}
              />
            </div>

            <div className="jawraa-subcard mt-5 p-4">
              <p className="text-xs font-medium text-[var(--ink-soft)]">
                {localeText.courseRuns.notes}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-strong)]">
                {run.notes || details.noNotes}
              </p>
            </div>
          </div>

          {!customerOnly ? (
            <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.nominations}</p>
                <h3 className="section-title">{details.currentNominations}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={panelHref(run.id, "enrollment")} className="secondary-button">
                  {details.addNominationButton}
                </Link>
              </div>
            </div>

            <form className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_auto]">
              <label className="field-shell">
                <span className="field-label">{details.filterAttendee}</span>
                <input
                  type="search"
                  name="attendee"
                  defaultValue={query.attendee ?? ""}
                  className="field-input"
                  placeholder={details.filterAttendee}
                />
              </label>
              <label className="field-shell">
                <span className="field-label">{details.filterEnrollmentStatus}</span>
                <select name="status" defaultValue={enrollmentStatusFilter} className="field-input">
                  <option value="">{details.allEnrollmentStatuses}</option>
                  <option value="PENDING">{enrollmentStatusText(locale).NOMINATED}</option>
                  <option value="CONFIRMED">{enrollmentStatusText(locale).CONFIRMED}</option>
                  <option value="CANCELLED">{enrollmentStatusText(locale).DECLINED}</option>
                  <option value="COMPLETED">{enrollmentStatusText(locale).WITHDRAWN}</option>
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" className="primary-button w-full sm:w-auto">
                  {localeText.courseRuns.applyFilters}
                </button>
              </div>
            </form>

            <div className="mt-5 space-y-3">
              {filteredEnrollments.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noNominations}
                </div>
              ) : (
                filteredEnrollments.map((nomination) => {
                  const latestAttendance = latestAttendanceByParticipant.get(nomination.participantId);
                  const attendanceLabel = latestAttendance
                    ? attendanceStatusText(locale)[latestAttendance.attendanceStatus]
                    : details.noAttendance;
                  const enrollmentDate = new Intl.DateTimeFormat(numberLocale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  }).format(nomination.nominatedAt);

                  return (
                    <div key={nomination.id} className="jawraa-subcard px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.8fr_0.8fr]">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink-strong)]">
                            {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ink-soft)]">
                            {nomination.participant.email ||
                              nomination.participant.organizationName ||
                              participantTypeText(locale)[nomination.participant.participantType]}
                          </p>
                          {nomination.notes ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                              {nomination.notes}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <InfoCard
                            label={details.nominationStatus}
                            value={getEnrollmentStatusLabel(locale, nomination.nominationStatus)}
                          />
                          <InfoCard label={details.enrollmentDate} value={enrollmentDate} />
                        </div>

                        <div className="space-y-3">
                          <InfoCard label={details.attendanceStatus} value={attendanceLabel} />
                          {canEditOps ? (
                            <form action={updateEnrollmentStatus} className="space-y-3">
                              <input type="hidden" name="trainingId" value={run.id} />
                              <input type="hidden" name="enrollmentId" value={nomination.id} />
                              <label className="field-shell">
                                <span className="field-label">{details.nominationStatus}</span>
                                <select
                                  name="enrollmentStatus"
                                  defaultValue={getEnrollmentEditValue(nomination.nominationStatus)}
                                  className="field-input"
                                >
                                  <option value="NOMINATED">{enrollmentStatusText(locale).NOMINATED}</option>
                                  <option value="CONFIRMED">{enrollmentStatusText(locale).CONFIRMED}</option>
                                  <option value="DECLINED">{enrollmentStatusText(locale).DECLINED}</option>
                                  <option value="WITHDRAWN">{enrollmentStatusText(locale).WITHDRAWN}</option>
                                </select>
                              </label>
                              <label className="field-shell">
                                <span className="field-label">{details.notes}</span>
                                <textarea
                                  name="notes"
                                  rows={3}
                                  defaultValue={nomination.notes ?? ""}
                                  className="field-input min-h-[5rem] resize-y"
                                />
                              </label>
                              <button type="submit" className="secondary-button w-full sm:w-auto">
                                {details.saveNomination}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </div>
          ) : null}

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.attendance}</p>
                <h3 className="section-title">{details.attendanceLog}</h3>
              </div>
            </div>

            {run.sessions.length === 0 ? (
              <div className="mt-5 jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                {details.addSessionsBeforeAttendance}
              </div>
            ) : attendanceGridEnrollments.length === 0 ? (
              <div className="mt-5 jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                {details.addEnrollmentsBeforeAttendance}
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="data-table min-w-[48rem]">
                  <thead>
                    <tr>
                      <th>{details.chooseAttendee}</th>
                      {run.sessions.map((session) => (
                        <th key={session.id}>
                          {new Intl.DateTimeFormat(numberLocale, {
                            month: "short",
                            day: "numeric",
                          }).format(session.sessionDate)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceGridEnrollments.map((nomination) => (
                      <tr key={nomination.id}>
                        <td>
                          <div className="min-w-[12rem]">
                            <p className="text-sm font-semibold text-[var(--ink-strong)]">
                              {nomination.participant.fullNameEn ||
                                nomination.participant.fullNameAr}
                            </p>
                            <p className="mt-1 text-xs text-[var(--ink-soft)]">
                              {getEnrollmentStatusLabel(locale, nomination.nominationStatus)}
                            </p>
                          </div>
                        </td>
                        {run.sessions.map((session) => {
                          const record = attendanceByCell.get(
                            attendanceCellKey(nomination.participantId, session.id),
                          );
                          const currentStatus = record?.attendanceStatus;
                          const statusLabel = currentStatus
                            ? attendanceStatusText(locale)[currentStatus]
                            : details.notRecorded;

                          return (
                            <td key={session.id}>
                              {canEditOps ? (
                                <form action={recordAttendance} className="min-w-[9rem] space-y-2">
                                  <input type="hidden" name="trainingId" value={run.id} />
                                  <input
                                    type="hidden"
                                    name="attendeeId"
                                    value={nomination.participantId}
                                  />
                                  <input
                                    type="hidden"
                                    name="trainingSessionId"
                                    value={session.id}
                                  />
                                  <input type="hidden" name="notes" value={record?.notes ?? ""} />
                                  <select
                                    name="attendanceStatus"
                                    defaultValue={currentStatus ?? "PRESENT"}
                                    className="field-input"
                                  >
                                    <option value="PRESENT">
                                      {attendanceStatusText(locale).PRESENT}
                                    </option>
                                    <option value="ABSENT">
                                      {attendanceStatusText(locale).ABSENT}
                                    </option>
                                  </select>
                                  <button type="submit" className="secondary-button w-full">
                                    {details.saveAttendance}
                                  </button>
                                  <p className="text-xs text-[var(--ink-soft)]">{statusLabel}</p>
                                </form>
                              ) : (
                                <span className="status-pill">{statusLabel}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.sessions}</p>
                <h3 className="section-title">{details.sessionSchedule}</h3>
                <p className="section-copy">{details.sessionDescription}</p>
              </div>
              <div className="min-w-[9rem]">
                <ProgressCard
                  label={details.totalSessions}
                  value={formatNumber(totalSessionCount, numberLocale)}
                  tone="teal"
                />
              </div>
            </div>

            {canEditOps ? (
              <form action={createTrainingSession} className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr_auto]">
                <input type="hidden" name="trainingId" value={run.id} />
                <label className="field-shell">
                  <span className="field-label">{details.sessionDate}</span>
                  <input type="date" name="sessionDate" className="field-input" required />
                </label>
                <label className="field-shell">
                  <span className="field-label">{details.sessionNotes}</span>
                  <input
                    type="text"
                    name="notes"
                    className="field-input"
                    placeholder={details.sessionNotes}
                  />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="primary-button w-full sm:w-auto">
                    {details.addSession}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-5 space-y-3">
              {run.sessions.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noSessions}
                </div>
              ) : (
                run.sessions.map((session) => (
                  <div key={session.id} className="jawraa-subcard px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--ink-strong)]">
                          {new Intl.DateTimeFormat(numberLocale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }).format(session.sessionDate)}
                        </p>
                        {session.notes ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                            {session.notes}
                          </p>
                        ) : null}
                      </div>

                      {canEditOps ? (
                        <form action={updateTrainingSession} className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-[0.8fr_1fr_auto]">
                          <input type="hidden" name="trainingId" value={run.id} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <label className="field-shell">
                            <span className="field-label">{details.sessionDate}</span>
                            <input
                              type="date"
                              name="sessionDate"
                              className="field-input"
                              defaultValue={formatDateInput(session.sessionDate)}
                              required
                            />
                          </label>
                          <label className="field-shell">
                            <span className="field-label">{details.sessionNotes}</span>
                            <input
                              type="text"
                              name="notes"
                              className="field-input"
                              defaultValue={session.notes ?? ""}
                            />
                          </label>
                          <div className="flex items-end">
                            <button type="submit" className="secondary-button w-full sm:w-auto">
                              {details.saveSession}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.completion}</p>
                <h3 className="section-title">{details.completionSummary}</h3>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <ProgressCard
                label={details.eligibleCount}
                value={formatNumber(eligibleCount, numberLocale)}
                tone="teal"
              />
              <ProgressCard
                label={details.threshold}
                value={`${Math.round(completionThreshold * 100)}%`}
                tone="sand"
              />
              <ProgressCard
                label={details.recordedAttendance}
                value={formatNumber(run._count.attendanceRecords, numberLocale)}
                tone="ink"
              />
            </div>

            <div className="jawraa-subcard mt-5 p-4">
              <p className="text-sm leading-7 text-[var(--ink-strong)]">
                {details.completionRule}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {completionRows.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noCompletionData}
                </div>
              ) : (
                completionRows.map((row) => (
                  <div
                    key={row.participantId}
                    className="jawraa-subcard px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink-strong)]">
                          {row.participantName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          {details.attendanceRate}: {Math.round(row.attendanceRate * 100)}%
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="status-pill">
                          {row.completionEligible ? details.yes : details.no} {details.completionEligible}
                        </span>
                        <span className="status-pill">
                          {row.certificateEligible ? details.yes : details.no} {details.certificateEligible}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoCard
                        label={details.attendedDays}
                        value={formatNumber(row.presentCount, numberLocale)}
                      />
                      <InfoCard
                        label={details.totalSessions}
                        value={formatNumber(row.totalSessions, numberLocale)}
                      />
                      <InfoCard
                        label={details.attendanceRate}
                        value={`${Math.round(row.attendanceRate * 100)}%`}
                      />
                      <InfoCard
                        label={details.certificateEligible}
                        value={row.certificateEligible ? details.yes : details.no}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.trainerAssignments}</p>
                <h3 className="section-title">{details.currentTrainers}</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {run.trainers.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noTrainers}
                </div>
              ) : (
                run.trainers.map((assignment) => (
                  <div
                    key={assignment.trainerId}
                    className="jawraa-subcard flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-strong)]">
                        {assignment.trainer.fullNameEn || assignment.trainer.fullNameAr}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {assignment.role ||
                          assignment.trainer.specialization ||
                          details.trainerRolePlaceholder}
                      </p>
                      {assignment.isPrimary ? (
                        <p className="mt-2 inline-flex rounded-full border border-[var(--brand-yellow)] bg-white px-3 py-1 text-xs font-semibold text-[var(--brand-ink)]">
                          {details.primaryTrainer}
                        </p>
                      ) : null}
                    </div>

                    {canEditOps ? (
                      <form action={removeInstructorFromTraining}>
                        <input type="hidden" name="trainingId" value={run.id} />
                        <input type="hidden" name="instructorId" value={assignment.trainerId} />
                        <button type="submit" className="secondary-button w-full sm:w-auto">
                          {details.remove}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <div className="panel-surface">
            <p className="eyebrow">{details.progress}</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {customerOnly ? (
                <>
                  <ProgressCard
                    label={details.plannedSeats}
                    value={formatNumber(trainingCapacity.estimatedSeats, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.confirmedSeats}
                    value={formatNumber(trainingCapacity.actualSeats, numberLocale)}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.utilizationPct}
                    value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                      trainingCapacity.utilizationPct,
                    )}%`}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.remainingCapacity}
                    value={formatNumber(trainingCapacity.remainingCapacity, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.fullyBooked}
                    value={trainingCapacity.fullyBooked ? details.yes : details.no}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.overCapacityBy}
                    value={formatNumber(trainingCapacity.overCapacityBy, numberLocale)}
                    tone="teal"
                  />
                </>
              ) : (
                <>
                  <ProgressCard
                    label={details.attendanceRequired}
                    value={run.attendanceRequired ? details.yes : details.no}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.certificateRequired}
                    value={run.certificateRequired ? details.yes : details.no}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.trainerAssignments}
                    value={formatNumber(run.trainers.length, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.totalEnrollments}
                    value={formatNumber(enrollmentSummary.totalEnrollments, numberLocale)}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.confirmedEnrollments}
                    value={formatNumber(enrollmentSummary.confirmedEnrollments, numberLocale)}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.cancelledEnrollments}
                    value={formatNumber(enrollmentSummary.cancelledEnrollments, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.completedEnrollments}
                    value={formatNumber(enrollmentSummary.completedEnrollments, numberLocale)}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.completionRate}
                    value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                      enrollmentSummary.completionRate,
                    )}%`}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.documents}
                    value={formatNumber(documents.length, numberLocale)}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.recordedAttendance}
                    value={formatNumber(run._count.attendanceRecords, numberLocale)}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.plannedSeats}
                    value={formatNumber(trainingCapacity.estimatedSeats, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.confirmedSeats}
                    value={formatNumber(trainingCapacity.actualSeats, numberLocale)}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.utilizationPct}
                    value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                      trainingCapacity.utilizationPct,
                    )}%`}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.remainingCapacity}
                    value={formatNumber(trainingCapacity.remainingCapacity, numberLocale)}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.fullyBooked}
                    value={trainingCapacity.fullyBooked ? details.yes : details.no}
                    tone="sand"
                  />
                  <ProgressCard
                    label={details.overCapacityBy}
                    value={formatNumber(trainingCapacity.overCapacityBy, numberLocale)}
                    tone="teal"
                  />
                  <ProgressCard
                    label={details.attendanceRate}
                    value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                      attendanceSummary.attendanceRate,
                    )}%`}
                    tone="ink"
                  />
                  <ProgressCard
                    label={details.courseStatus}
                    value={localeText.courseRunStatuses[run.status]}
                    tone="teal"
                  />
                </>
              )}
            </div>
          </div>

          {canSeeFinancials && trainingFinancials ? (
            <div className="panel-surface">
              <p className="eyebrow">{details.financialTitle}</p>
              <h3 className="section-title">{details.financialTitle}</h3>
              <p className="section-copy">{details.financialDescription}</p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {canManageFinancials ? (
                  <ProgressCard
                    label={details.vendorCost}
                    value={formatCurrency(trainingFinancials.vendorCost, numberLocale)}
                    tone="ink"
                  />
                ) : null}
                <ProgressCard
                  label={details.revenue}
                  value={formatCurrency(trainingFinancials.revenue, numberLocale)}
                  tone="sand"
                />
                <ProgressCard
                  label={details.grossMargin}
                  value={formatCurrency(trainingFinancials.grossMargin, numberLocale)}
                  tone="teal"
                />
                <ProgressCard
                  label={details.marginPct}
                  value={`${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(
                    trainingFinancials.marginPct,
                  )}%`}
                  tone="ink"
                />
              </div>
            </div>
          ) : null}

          {canEditOps ? (
            <div className="panel-surface">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow">{details.evaluationTitle}</p>
                  <h3 className="section-title">{details.evaluationTitle}</h3>
                  <p className="section-copy">{details.evaluationDescription}</p>
                </div>
              </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ProgressCard
                label={details.averageCourseRating}
                value={formatAverageRating(averageCourseRating, numberLocale)}
                tone="teal"
              />
              <ProgressCard
                label={details.averageInstructorRating}
                value={formatAverageRating(averageInstructorRating, numberLocale)}
                tone="sand"
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <form action={upsertCourseEvaluation} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />
                <div>
                  <p className="eyebrow">{details.courseEvaluation}</p>
                </div>

                <label className="field-shell">
                  <span className="field-label">{details.chooseAttendee}</span>
                  <select name="attendeeId" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.chooseAttendee}
                    </option>
                    {run.nominations.map((nomination) => (
                      <option key={nomination.participantId} value={nomination.participantId}>
                        {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.rating}</span>
                  <select name="rating" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.rating}
                    </option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.comments}</span>
                  <textarea name="comments" rows={4} className="field-input min-h-[7rem] resize-y" />
                </label>

                <button type="submit" className="secondary-button w-full sm:w-auto">
                  {details.courseEvaluation}
                </button>
              </form>

              <form action={upsertInstructorEvaluation} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />
                <div>
                  <p className="eyebrow">{details.instructorEvaluation}</p>
                </div>

                <label className="field-shell">
                  <span className="field-label">{details.chooseAttendee}</span>
                  <select name="attendeeId" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.chooseAttendee}
                    </option>
                    {run.nominations.map((nomination) => (
                      <option key={nomination.participantId} value={nomination.participantId}>
                        {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.chooseTrainer}</span>
                  <select name="subjectInstructorId" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.chooseTrainer}
                    </option>
                    {run.trainers.map((assignment) => (
                      <option key={assignment.trainerId} value={assignment.trainerId}>
                        {assignment.trainer.fullNameEn || assignment.trainer.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.rating}</span>
                  <select name="rating" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.rating}
                    </option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.comments}</span>
                  <textarea name="comments" rows={4} className="field-input min-h-[7rem] resize-y" />
                </label>

                <button type="submit" className="secondary-button w-full sm:w-auto">
                  {details.instructorEvaluation}
                </button>
              </form>

              <form action={upsertAttendeeEvaluation} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />
                <div>
                  <p className="eyebrow">{details.attendeeEvaluation}</p>
                </div>

                <label className="field-shell">
                  <span className="field-label">{details.chooseTrainer}</span>
                  <select name="evaluatorInstructorId" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.chooseTrainer}
                    </option>
                    {run.trainers.map((assignment) => (
                      <option key={assignment.trainerId} value={assignment.trainerId}>
                        {assignment.trainer.fullNameEn || assignment.trainer.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.chooseAttendee}</span>
                  <select name="attendeeId" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.chooseAttendee}
                    </option>
                    {run.nominations.map((nomination) => (
                      <option key={nomination.participantId} value={nomination.participantId}>
                        {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.rating}</span>
                  <select name="rating" className="field-input" defaultValue="" required>
                    <option value="" disabled>
                      {details.rating}
                    </option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.comments}</span>
                  <textarea name="comments" rows={4} className="field-input min-h-[7rem] resize-y" />
                </label>

                <button type="submit" className="secondary-button w-full sm:w-auto">
                  {details.attendeeEvaluation}
                </button>
              </form>
            </div>
            </div>
          ) : null}

          {canEditOps ? (
            <div className="panel-surface">
            <div>
              <p className="eyebrow">{details.documentVault}</p>
              <h3 className="section-title">{details.documents}</h3>
              <p className="section-copy">{details.documentVaultDescription}</p>
            </div>

            <form
              action="/api/course-run-documents"
              method="post"
              encType="multipart/form-data"
              className="mt-5 space-y-4"
            >
              <input type="hidden" name="courseRunId" value={run.id} />
              <input type="hidden" name="returnPath" value={`/trainings/${run.id}`} />

              <div className="grid gap-4 xl:grid-cols-3">
                <label className="field-shell">
                  <span className="field-label">{details.documentType}</span>
                  <select
                    name="documentType"
                    className="field-input"
                    defaultValue={DocumentType.ATTENDANCE_SHEET}
                  >
                    {Object.entries(documentTypeText(locale)).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell xl:col-span-2">
                  <span className="field-label">{details.documentFile}</span>
                  <input
                    type="file"
                    name="file"
                    className="field-input"
                    accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip"
                  />
                </label>
              </div>

              <label className="field-shell">
                <span className="field-label">{details.documentNotes}</span>
                <textarea
                  name="notes"
                  rows={3}
                  className="field-input min-h-[6rem] resize-y"
                />
              </label>

              <button type="submit" className="primary-button w-full sm:w-auto">
                {details.uploadDocument}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {documents.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noDocuments}
                </div>
              ) : (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="jawraa-subcard flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">
                        {document.originalFileName || document.fileName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {documentTypeText(locale)[document.documentType]} | {details.version}{" "}
                        {document.version} | {details.fileSize}:{" "}
                        {formatFileSize(document.fileSizeBytes, numberLocale)}
                      </p>
                      {document.notes ? (
                        <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">
                          {document.notes}
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={document.fileUrl}
                      className="secondary-button w-full sm:w-auto"
                    >
                      {details.download}
                    </Link>
                  </div>
                ))
              )}
            </div>
            </div>
          ) : null}
        </div>
      </section>

      {openPanel && canEditOps ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_30px_70px_rgba(10,25,35,0.35)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">
                  {openPanel === "edit"
                    ? details.edit
                    : openPanel === "instructor"
                      ? details.addTrainer
                      : details.addNomination}
                </p>
                <h3 className="section-title">
                  {openPanel === "edit"
                    ? details.editButton
                    : openPanel === "instructor"
                      ? details.addTrainerButton
                      : openPanel === "enrollment"
                        ? details.addNominationButton
                        : details.addAttendanceButton}
                </h3>
              </div>
              <Link href={`/trainings/${run.id}`} className="secondary-button">
                {details.close}
              </Link>
            </div>

            {openPanel === "edit" ? (
              <form action={updateTraining} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />

                <label className="field-shell">
                  <span className="field-label">
                    {localeText.courseRuns.purchaseOrderCourseEntry}
                  </span>
                  <select
                    name="purchaseOrderCourseEntryId"
                    className="field-input"
                    defaultValue={run.projectScopeCourseId || ""}
                    required
                  >
                    <option value="" disabled>
                      {localeText.courseRuns.selectPurchaseOrderCourseEntry}
                    </option>
                    {purchaseOrderCourseEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {formatPurchaseOrderCode(entry.scope.code, locale)} |{" "}
                        {formatPurchaseOrderTitle(entry.scope, locale)} |{" "}
                        {entry.course.courseCode} | {entry.course.nameEn || entry.course.nameAr} |{" "}
                        {localeText.courseRuns.plannedSeats}: {entry.estimatedSeats ?? "-"}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.status}</span>
                    <select name="status" className="field-input" defaultValue={run.status}>
                      {Object.entries(localeText.courseRunStatuses).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.deliveryMode}</span>
                    <select
                      name="deliveryMode"
                      className="field-input"
                      defaultValue={run.deliveryMode}
                    >
                      {Object.entries(localeText.deliveryModes).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.startDate}</span>
                    <input
                      type="date"
                      name="startDate"
                      className="field-input"
                      defaultValue={formatDateInput(run.startDate)}
                    />
                  </label>

                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.endDate}</span>
                    <input
                      type="date"
                      name="endDate"
                      className="field-input"
                      defaultValue={formatDateInput(run.endDate)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">{details.provider}</span>
                    <select
                      name="vendorId"
                      className="field-input"
                      defaultValue={run.providerId || ""}
                    >
                      <option value="">{details.chooseProvider}</option>
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.nameEn || provider.nameAr}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-shell">
                    <span className="field-label">{details.location}</span>
                    <select
                      name="locationId"
                      className="field-input"
                      defaultValue={run.locationId || ""}
                    >
                      <option value="">{details.chooseLocation}</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.nameEn || location.nameAr}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {canManageFinancials ? (
                    <label className="field-shell">
                      <span className="field-label">{details.vendorCost}</span>
                      <input
                        type="number"
                        name="vendorCost"
                        step="0.01"
                        min="0"
                        className="field-input"
                        defaultValue={
                          run.vendorCost !== null && run.vendorCost !== undefined
                            ? Number(run.vendorCost)
                            : ""
                        }
                      />
                    </label>
                  ) : null}

                  <label className="field-shell">
                    <span className="field-label">{details.daysHeld}</span>
                    <input
                      type="number"
                      name="daysHeld"
                      min="0"
                      step="1"
                      className="field-input"
                      defaultValue={run.daysHeld ?? ""}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">{details.city}</span>
                    <select name="city" className="field-input" defaultValue={run.city || ""}>
                      <option value="">{details.selectCity}</option>
                      {Object.values(TrainingCity).map((city) => (
                        <option key={city} value={city}>
                          {
                            localeText.courseRuns.trainingCities[
                              city as keyof typeof localeText.courseRuns.trainingCities
                            ]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.notes}</span>
                  <textarea
                    name="notes"
                    rows={5}
                    className="field-input min-h-[8rem] resize-y"
                    defaultValue={run.notes || ""}
                  />
                </label>

                <button type="submit" className="primary-button w-full sm:w-auto">
                  {details.save}
                </button>
              </form>
            ) : openPanel === "instructor" ? (
              <form action={assignInstructorToTraining} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />

                <label className="field-shell">
                  <span className="field-label">{details.addTrainer}</span>
                  <select name="instructorId" className="field-input" defaultValue="">
                    <option value="" disabled>
                      {details.chooseTrainer}
                    </option>
                    {trainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.fullNameEn || trainer.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-shell">
                  <span className="field-label">{details.trainerRole}</span>
                  <input
                    type="text"
                    name="role"
                    className="field-input"
                    placeholder={details.trainerRolePlaceholder}
                  />
                </label>

                <label className="jawraa-subcard flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--ink-strong)]">
                  <input type="checkbox" name="isPrimary" value="true" />
                  <span>{details.primaryTrainer}</span>
                </label>

                <button type="submit" className="primary-button w-full sm:w-auto">
                  {details.addTrainer}
                </button>
              </form>
            ) : openPanel === "enrollment" ? (
              <div className="space-y-6">
                <form action={enrollExistingAttendee} className="space-y-4">
                  <input type="hidden" name="trainingId" value={run.id} />

                  <div>
                    <p className="eyebrow">{details.existingParticipant}</p>
                  </div>

                  <label className="field-shell">
                    <span className="field-label">{details.chooseParticipant}</span>
                    <select name="attendeeId" className="field-input" defaultValue="">
                      <option value="" disabled>
                        {details.chooseParticipant}
                      </option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.fullNameEn || participant.fullNameAr}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.nominationStatus}</span>
                      <select
                        name="enrollmentStatus"
                        className="field-input"
                        defaultValue="NOMINATED"
                      >
                        {Object.entries(enrollmentStatusText(locale)).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-shell">
                      <span className="field-label">{localeText.courseRuns.notes}</span>
                      <input
                        type="text"
                        name="notes"
                        className="field-input"
                        placeholder={localeText.courseRuns.notesPlaceholder}
                      />
                    </label>
                  </div>

                  <button type="submit" className="secondary-button w-full sm:w-auto">
                    {details.saveNomination}
                  </button>
                </form>

                <div className="h-px bg-[var(--line-soft)]" />

                <form action={createAttendeeAndEnroll} className="space-y-4">
                  <input type="hidden" name="trainingId" value={run.id} />

                  <div>
                    <p className="eyebrow">{details.quickCreateParticipant}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.participantType}</span>
                      <select
                        name="attendeeType"
                        className="field-input"
                        defaultValue="STUDENT"
                      >
                        {Object.entries(participantTypeText(locale)).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-shell">
                      <span className="field-label">{details.nominationStatus}</span>
                      <select
                        name="enrollmentStatus"
                        className="field-input"
                        defaultValue="NOMINATED"
                      >
                        {Object.entries(enrollmentStatusText(locale)).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.participantNameAr}</span>
                      <input type="text" name="fullNameAr" className="field-input" />
                    </label>

                    <label className="field-shell">
                      <span className="field-label">{details.participantNameEn}</span>
                      <input type="text" name="fullNameEn" className="field-input" />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.participantEmail}</span>
                      <input type="email" name="email" className="field-input" />
                    </label>

                    <label className="field-shell">
                      <span className="field-label">{details.participantPhone}</span>
                      <input type="text" name="phone" className="field-input" />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.participantOrg}</span>
                      <input type="text" name="organizationName" className="field-input" />
                    </label>

                    <label className="field-shell">
                      <span className="field-label">{details.participantJobTitle}</span>
                      <input type="text" name="jobTitle" className="field-input" />
                    </label>
                  </div>

                  <label className="field-shell">
                    <span className="field-label">{details.participantNationalId}</span>
                    <input type="text" name="nationalIdOrIqama" className="field-input" />
                  </label>

                  <label className="field-shell">
                    <span className="field-label">{localeText.courseRuns.notes}</span>
                    <textarea
                      name="notes"
                      rows={4}
                      className="field-input min-h-[7rem] resize-y"
                      placeholder={localeText.courseRuns.notesPlaceholder}
                    />
                  </label>

                  <button type="submit" className="primary-button w-full sm:w-auto">
                    {details.createAndNominate}
                  </button>
                </form>
              </div>
            ) : run.sessions.length === 0 ? (
              <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                {details.addSessionsBeforeAttendance}
              </div>
            ) : (
              <form action={recordAttendance} className="space-y-4">
                <input type="hidden" name="trainingId" value={run.id} />

                <label className="field-shell">
                  <span className="field-label">{details.chooseAttendee}</span>
                  <select name="attendeeId" className="field-input" defaultValue="">
                    <option value="" disabled>
                      {details.chooseAttendee}
                    </option>
                    {run.nominations.map((nomination) => (
                      <option key={nomination.participantId} value={nomination.participantId}>
                        {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">{details.sessionDate}</span>
                    <select name="trainingSessionId" className="field-input" defaultValue="" required>
                      <option value="" disabled>
                        {details.chooseSession}
                      </option>
                      {run.sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {new Intl.DateTimeFormat(numberLocale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }).format(session.sessionDate)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-shell">
                    <span className="field-label">{details.attendanceStatus}</span>
                    <select
                      name="attendanceStatus"
                      className="field-input"
                      defaultValue="PRESENT"
                    >
                      {Object.entries(attendanceStatusText(locale)).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.notes}</span>
                  <textarea
                    name="notes"
                    rows={4}
                    className="field-input min-h-[7rem] resize-y"
                    placeholder={localeText.courseRuns.notesPlaceholder}
                  />
                </label>

                <button type="submit" className="primary-button w-full sm:w-auto">
                  {details.saveAttendance}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-7 text-[var(--ink-strong)]">
        {value}
      </p>
    </div>
  );
}

function ProgressCard({
  label,
  value,
}: {
  label: string;
  value: string;
  tone: "teal" | "sand" | "ink";
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-xs font-medium text-[var(--ink-soft)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
