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
import { InstantSearchField } from "@/components/instant-search-field";
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
import {
  getTrainingCapacity,
  getTrainingSessionAttendanceRate,
} from "@/server/services/capacity-service";
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
    enrollmentPage?: string;
    attendanceQ?: string;
    attendancePage?: string;
    attendanceView?: string;
    completionQ?: string;
    completionPage?: string;
    completionView?: string;
  }>;
};

const ENROLLMENTS_PAGE_SIZE = 10;
const ATTENDANCE_PAGE_SIZE = 10;
const COMPLETION_PAGE_SIZE = 10;

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

function normalizePage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function paginationPages(current: number, total: number) {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
    .reduce<Array<number | "ellipsis">>((items, page) => {
      const previous = items.at(-1);
      if (typeof previous === "number" && page - previous > 1) {
        items.push("ellipsis");
      }
      items.push(page);
      return items;
    }, []);
}

function enrollmentPageHref(
  trainingId: string,
  page: number,
  attendee?: string,
  status?: string,
) {
  const query = new URLSearchParams();
  if (attendee) query.set("attendee", attendee);
  if (status) query.set("status", status);
  if (page > 1) query.set("enrollmentPage", String(page));
  const queryString = query.toString();
  return queryString ? `/trainings/${trainingId}?${queryString}` : `/trainings/${trainingId}`;
}

function attendancePageHref(
  trainingId: string,
  page: number,
  attendanceQ?: string,
  view?: string,
) {
  const query = new URLSearchParams();
  if (attendanceQ) query.set("attendanceQ", attendanceQ);
  if (view === "all") query.set("attendanceView", "all");
  if (page > 1 && view !== "all") query.set("attendancePage", String(page));
  const queryString = query.toString();
  return queryString ? `/trainings/${trainingId}?${queryString}` : `/trainings/${trainingId}`;
}

function completionPageHref(
  trainingId: string,
  page: number,
  completionQ?: string,
  view?: string,
) {
  const query = new URLSearchParams();
  if (completionQ) query.set("completionQ", completionQ);
  if (view === "all") query.set("completionView", "all");
  if (page > 1 && view !== "all") query.set("completionPage", String(page));
  const queryString = query.toString();
  return queryString ? `/trainings/${trainingId}?${queryString}` : `/trainings/${trainingId}`;
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
      title: "تفاصيل التدريب",
      description:
        "راجع معلومات التدريب الحالية، ثم استخدم الأزرار العلوية لتعديل التدريب أو إضافة مدرب أو إدارة التسجيلات.",
      edit: "تعديل التدريب",
      editButton: "فتح تعديل التدريب",
      addTrainer: "إضافة مدرب",
      addTrainerButton: "فتح إضافة مدرب",
      addNomination: "إضافة تسجيل",
      addNominationButton: "فتح إضافة تسجيل",
      addAttendance: "تسجيل حضور",
      addAttendanceButton: "فتح تسجيل الحضور",
      summary: "الملخص",
      progress: "مؤشرات التقدم",
      provider: "المورد",
      location: "الموقع",
      chooseProvider: "اختر موردا",
      chooseLocation: "اختر موقع",
      save: "حفظ التعديلات",
      back: "العودة",
      notAssigned: "غير مسند بعد",
      noNotes: "لا توجد ملاحظات",
      trainerAssignments: "إسنادات المدربين",
      currentTrainers: "المدربون الحاليون",
      chooseTrainer: "اختر مدرب",
      trainerRole: "دور المدرب",
      trainerRolePlaceholder: "مدرب رئيسي أو مساعد",
      primaryTrainer: "مدرب رئيسي",
      noTrainers: "لا يوجد مدربون مسندون حتى الآن",
      remove: "إزالة",
      nominations: "التسجيلات",
      currentNominations: "التسجيلات الحالية",
      chooseParticipant: "اختر أحد الحضور",
      nominationStatus: "حالة التسجيل",
      participantType: "نوع الحضور",
      participantNameAr: "الاسم بالعربية",
      participantNameEn: "الاسم بالإنجليزية",
      participantEmail: "البريد الإلكتروني",
      participantPhone: "الجوال",
      participantOrg: "الجهة",
      participantJobTitle: "المسمى الوظيفي",
      participantNationalId: "رقم الهوية / الإقامة",
      existingParticipant: "تسجيل حضور موجود",
      quickCreateParticipant: "إضافة حضور جديد وتسجيله",
      noNominations: "لا توجد تسجيلات حتى الآن",
      saveNomination: "حفظ التسجيل",
      createAndNominate: "إضافة وتسجيل",
      attendance: "الحضور",
      attendanceLog: "سجل الحضور",
      seeAllAttendance: "عرض كل الحضور",
      showPagedAttendance: "عرض الصفحات",
      noAttendance: "لا توجد سجلات حضور حتى الآن",
      addEnrollmentsBeforeAttendance: "أضف الحضور إلى التدريب قبل تسجيل الحضور.",
      notRecorded: "لم يسجل",
      attendanceDate: "تاريخ الحضور",
      attendanceStatus: "حالة الحضور",
      chooseAttendee: "اختر من الحضور المسجلين",
      chooseSession: "اختر جلسة",
      saveAttendance: "حفظ الحضور",
      recordedAttendance: "الحضور المسجل",
      completion: "الاكتمال والأهلية",
      completionSummary: "ملخص الاكتمال",
      noCompletionData: "لا توجد بيانات حضور كافية لحساب الاكتمال حتى الآن",
      attendanceRate: "نسبة الحضور",
      attendedDays: "أيام الحضور",
      attended: "حضر",
      missed: "فاتته",
      sessionAttendanceDetail: "تفاصيل حضور الجلسات",
      totalSessions: "إجمالي الجلسات",
      completionEligible: "مؤهل للاكتمال",
      certificateEligible: "مؤهل للشهادة",
      completionRule: "يعتبر الحاضر مؤهلاً عند حضور 75% على الأقل من الجلسات المسجلة.",
      eligibleCount: "الحضور المؤهلون",
      sessions: "الجلسات",
      sessionSchedule: "جدول الجلسات",
      sessionDescription: "أضف أو عدل أيام التدريب دون تغيير حالة التدريب.",
      sessionDate: "تاريخ الجلسة",
      sessionNotes: "ملاحظات الجلسة",
      addSession: "إضافة جلسة",
      editSession: "تعديل الجلسة",
      saveSession: "حفظ الجلسة",
      noSessions: "لا توجد جلسات مضافة حتى الآن.",
      addSessionsBeforeAttendance: "أضف جلسات التدريب أولا قبل تسجيل الحضور.",
      threshold: "حد الاكتمال",
      capacityTitle: "سعة التدريب",
      capacityDescription: "المقاعد التقديرية مقابل المقاعد المؤكدة لهذا التدريب.",
      utilizationPct: "نسبة الاستغلال %",
      remainingCapacity: "السعة المتبقية",
      fullyBooked: "محجوز بالكامل",
      overCapacityBy: "التجاوز بمقدار",
      financialTitle: "المؤشرات المالية",
      financialDescription: "الإيراد وتكلفة المورد وهامش الربح لهذا التدريب.",
      vendorCost: "تكلفة المورد",
      revenue: "الإيراد",
      grossMargin: "هامش الربح",
      marginPct: "هامش الربح %",
      documents: "المستندات",
      documentVault: "المستندات",
      documentVaultDescription: "ارفع واحفظ المستندات المتعلقة بهذا البرنامج التدريبي الجاري مثل الحضور والتقارير والشهادات والصور.",
      documentType: "نوع المستند",
      documentFile: "الملف",
      documentNotes: "وصف أو ملاحظات",
      uploadDocument: "رفع المستند",
      noDocuments: "لا توجد مستندات مرفوعة لهذا التدريب حتى الآن",
      download: "تحميل",
      fileSize: "حجم الملف",
      version: "الإصدار",
      attendanceRequired: "يتطلب حضور",
      certificateRequired: "يتطلب شهادة",
      confirmedSeats: "المقاعد الفعلية",
      vendor: "المورد",
      city: "المدينة",
      selectCity: "اختر المدينة",
      daysHeld: "أيام التعاقد",
      yes: "نعم",
      no: "لا",
      close: "إغلاق",
      plannedSeats: "المقاعد التقديرية",
      courseStatus: "حالة التدريب",
      enrollmentDate: "تاريخ التسجيل",
      notes: "ملاحظات",
      filterAttendee: "تصفية حسب الحضور",
      filterEnrollmentStatus: "تصفية حسب حالة التسجيل",
      allEnrollmentStatuses: "جميع حالات التسجيل",
      totalEnrollments: "إجمالي التسجيلات",
      confirmedEnrollments: "المؤكدة",
      cancelledEnrollments: "الملغاة",
      completedEnrollments: "المكتملة",
      completionRate: "نسبة الإكمال %",
      evaluationTitle: "تقييمات التدريب",
      evaluationDescription: "قم بتسجيل تقييم للدورة أو المدرب أو المتدرب.",
      courseEvaluation: "تقييم الدورة",
      instructorEvaluation: "تقييم المدرب",
      attendeeEvaluation: "تقييم المتدرب",
      rating: "التقييم",
      comments: "التعليقات",
      averageCourseRating: "متوسط تقييم الدورة",
      averageInstructorRating: "متوسط تقييم المدرب",
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
    seeAllAttendance: "See all attendance",
    showPagedAttendance: "Show paged list",
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
    evaluationDescription: "Record course, instructor, and attendee evaluations.",
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
    attended: "Attended",
    missed: "Missed",
    sessionAttendanceDetail: "Session attendance detail",
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
      NOMINATED: "قيد الانتظار",
      CONFIRMED: "مؤكد",
      DECLINED: "ملغى",
      WITHDRAWN: "مكتمل",
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
      STUDENT: "متدرب",
      TEACHER: "مدرب",
      OWNER: "مالك",
      COORDINATOR: "منسق",
      OBSERVER: "مراقب",
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
      PRESENT: "حاضر",
      ABSENT: "غائب",
      LATE: "متأخر",
      EXCUSED: "بعذر",
      PARTIAL: "حضور جزئي",
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
      COURSE_CARD: "بطاقة الدورة",
      PRESENTATION: "عرض تقديمي",
      LEARNER_GUIDE: "دليل المتدرب",
      ATTENDANCE_SHEET: "كشف الحضور",
      CERTIFICATE_TEMPLATE: "نموذج الشهادة",
      QUALITY_REPORT: "تقرير الجودة",
      FINAL_REPORT: "التقرير النهائي",
      PHOTOS_ARCHIVE: "أرشيف الصور",
      OTHER: "أخرى",
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
  const enrollmentSearchRaw = (query.attendee ?? "").trim();
  const enrollmentStatusFilter = (query.status ?? "").trim();
  const requestedEnrollmentPage = normalizePage(query.enrollmentPage);
  const attendanceSearch = (query.attendanceQ ?? "").trim().toLowerCase();
  const attendanceSearchRaw = (query.attendanceQ ?? "").trim();
  const requestedAttendancePage = normalizePage(query.attendancePage);
  const showAllAttendance = query.attendanceView === "all";
  const completionSearch = (query.completionQ ?? "").trim().toLowerCase();
  const completionSearchRaw = (query.completionQ ?? "").trim();
  const requestedCompletionPage = normalizePage(query.completionPage);
  const showAllCompletion = query.completionView === "all";
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
          include: { course: true, scope: true },
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
  const selectedPurchaseOrderCourseEntryId =
    run.projectScopeCourseId ||
    purchaseOrderCourseEntries.find(
      (entry) =>
        entry.scopeId === run.projectScopeId && entry.courseId === run.courseId,
    )?.id ||
    "";
  const [trainingFinancials, averageCourseRating, averageInstructorRating] = await Promise.all([
    getTrainingFinancials(run.id),
    getAverageCourseRating(run.id),
    getAverageInstructorRating(run.id),
  ]);
  const trainingCapacity = getTrainingCapacity({
    plannedSeats: run.plannedSeats,
    confirmedSeats: run.confirmedSeats,
  });
  const attendanceSummary = await getTrainingSessionAttendanceRate(run.id);
  const totalSessionCount = run.sessions.length;
  const latestAttendanceByParticipant = new Map<
    string,
    (typeof run.attendanceRecords)[number]
  >();

  for (const record of run.attendanceRecords) {
    if (!latestAttendanceByParticipant.has(record.participantId)) {
      latestAttendanceByParticipant.set(record.participantId, record);
    }
  }

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

  const completionRows = run.nominations
    .filter((nomination) => {
      const status = getEnrollmentDisplayStatus(nomination.nominationStatus);
      return status === "PENDING" || status === "CONFIRMED";
    })
    .map((nomination) => {
      const presentCount = run.sessions.reduce((count, session) => {
        const record = attendanceByCell.get(
          attendanceCellKey(nomination.participantId, session.id),
        );
        return record?.attendanceStatus === "PRESENT" ? count + 1 : count;
      }, 0);
      const attendanceRate =
        totalSessionCount > 0 ? presentCount / totalSessionCount : 0;
      const sessionDetails = run.sessions.map((session) => {
        const record = attendanceByCell.get(
          attendanceCellKey(nomination.participantId, session.id),
        );

        return {
          sessionId: session.id,
          sessionDate: session.sessionDate,
          attended: record?.attendanceStatus === "PRESENT",
        };
      });
      const completionEligible = attendanceRate >= completionThreshold;
      const certificateEligible =
        run.certificateRequired && completionEligible ? true : !run.certificateRequired;

      return {
        participantId: nomination.participantId,
        participantName:
          nomination.participant.fullNameEn || nomination.participant.fullNameAr,
        presentCount,
        totalSessions: totalSessionCount,
        attendanceRate,
        sessionDetails,
        completionEligible,
        certificateEligible,
      };
    })
    .filter((row) => row.totalSessions > 0)
    .sort((left, right) => right.attendanceRate - left.attendanceRate);

  const eligibleCount = completionRows.filter((item) => item.completionEligible).length;
  const filteredCompletionRows = completionRows.filter((row) =>
    !completionSearch || row.participantName.toLowerCase().includes(completionSearch),
  );
  const totalCompletionPages = Math.max(
    1,
    Math.ceil(filteredCompletionRows.length / COMPLETION_PAGE_SIZE),
  );
  const safeCompletionPage = Math.min(requestedCompletionPage, totalCompletionPages);
  const visibleCompletionRows = showAllCompletion
    ? filteredCompletionRows
    : filteredCompletionRows.slice(
        (safeCompletionPage - 1) * COMPLETION_PAGE_SIZE,
        safeCompletionPage * COMPLETION_PAGE_SIZE,
      );

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
  const totalEnrollmentPages = Math.max(
    1,
    Math.ceil(filteredEnrollments.length / ENROLLMENTS_PAGE_SIZE),
  );
  const safeEnrollmentPage = Math.min(requestedEnrollmentPage, totalEnrollmentPages);
  const visibleEnrollments = filteredEnrollments.slice(
    (safeEnrollmentPage - 1) * ENROLLMENTS_PAGE_SIZE,
    safeEnrollmentPage * ENROLLMENTS_PAGE_SIZE,
  );

  const attendanceGridEnrollments = run.nominations.filter((nomination) => {
    const status = getEnrollmentDisplayStatus(nomination.nominationStatus);
    return status === "PENDING" || status === "CONFIRMED";
  });
  const filteredAttendanceGridEnrollments = attendanceGridEnrollments.filter((nomination) => {
    if (!attendanceSearch) return true;

    const participantSearch = [
      nomination.participant.fullNameAr,
      nomination.participant.fullNameEn,
      nomination.participant.email,
      nomination.participant.organizationName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return participantSearch.includes(attendanceSearch);
  });
  const totalAttendancePages = Math.max(
    1,
    Math.ceil(filteredAttendanceGridEnrollments.length / ATTENDANCE_PAGE_SIZE),
  );
  const safeAttendancePage = Math.min(requestedAttendancePage, totalAttendancePages);
  const visibleAttendanceGridEnrollments = showAllAttendance
    ? filteredAttendanceGridEnrollments
    : filteredAttendanceGridEnrollments.slice(
        (safeAttendancePage - 1) * ATTENDANCE_PAGE_SIZE,
        safeAttendancePage * ATTENDANCE_PAGE_SIZE,
      );

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/trainings"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
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
              {canSeeFinancials && trainingFinancials ? (
                <InfoCard
                  label={details.vendorCost}
                  value={formatCurrency(trainingFinancials.vendorCost, numberLocale)}
                />
              ) : null}
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
                <a
                  href={`/api/trainings/${run.id}/enrollments/export`}
                  className="secondary-button"
                >
                  {localeText.buttons.exportExcel}
                </a>
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
                visibleEnrollments.map((nomination) => {
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
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_auto] lg:items-start">
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

                        <InfoCard
                          label={details.nominationStatus}
                          value={getEnrollmentStatusLabel(locale, nomination.nominationStatus)}
                        />

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <InfoCard label={details.enrollmentDate} value={enrollmentDate} />
                          <InfoCard label={details.attendanceStatus} value={attendanceLabel} />
                        </div>

                        {canEditOps ? (
                          <details className="lg:justify-self-end">
                            <summary className="secondary-button cursor-pointer list-none text-center">
                              {details.edit}
                            </summary>
                            <form action={updateEnrollmentStatus} className="mt-4 min-w-[min(22rem,80vw)] space-y-3 rounded-[8px] border border-[rgba(17,17,17,0.08)] bg-white p-4">
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
                          </details>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {filteredEnrollments.length > ENROLLMENTS_PAGE_SIZE ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safeEnrollmentPage, numberLocale))
                    .replace("{total}", formatNumber(totalEnrollmentPages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={enrollmentPageHref(run.id, 1, enrollmentSearchRaw, enrollmentStatusFilter)}
                    aria-disabled={safeEnrollmentPage <= 1}
                    className={`pagination-link ${safeEnrollmentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={enrollmentPageHref(
                      run.id,
                      Math.max(1, safeEnrollmentPage - 1),
                      enrollmentSearchRaw,
                      enrollmentStatusFilter,
                    )}
                    aria-disabled={safeEnrollmentPage <= 1}
                    className={`pagination-link ${safeEnrollmentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.previous}
                  </Link>
                  {paginationPages(safeEnrollmentPage, totalEnrollmentPages).map((page, index) =>
                    page === "ellipsis" ? (
                      <span key={`enrollment-ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={enrollmentPageHref(
                          run.id,
                          page,
                          enrollmentSearchRaw,
                          enrollmentStatusFilter,
                        )}
                        aria-current={page === safeEnrollmentPage ? "page" : undefined}
                        className={`pagination-link ${page === safeEnrollmentPage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={enrollmentPageHref(
                      run.id,
                      Math.min(totalEnrollmentPages, safeEnrollmentPage + 1),
                      enrollmentSearchRaw,
                      enrollmentStatusFilter,
                    )}
                    aria-disabled={safeEnrollmentPage >= totalEnrollmentPages}
                    className={`pagination-link ${safeEnrollmentPage >= totalEnrollmentPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={enrollmentPageHref(
                      run.id,
                      totalEnrollmentPages,
                      enrollmentSearchRaw,
                      enrollmentStatusFilter,
                    )}
                    aria-disabled={safeEnrollmentPage >= totalEnrollmentPages}
                    className={`pagination-link ${safeEnrollmentPage >= totalEnrollmentPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.last}
                  </Link>
                </div>
              </div>
            ) : null}
            </div>
          ) : null}

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.attendance}</p>
                <h3 className="section-title">{details.attendanceLog}</h3>
              </div>
              {filteredAttendanceGridEnrollments.length > ATTENDANCE_PAGE_SIZE ? (
                <Link
                  href={
                    showAllAttendance
                      ? attendancePageHref(run.id, 1, attendanceSearchRaw)
                      : attendancePageHref(run.id, 1, attendanceSearchRaw, "all")
                  }
                  className="secondary-button"
                >
                  {showAllAttendance ? details.showPagedAttendance : details.seeAllAttendance}
                </Link>
              ) : null}
              <a
                href={`/api/trainings/${run.id}/attendance/export`}
                className="secondary-button"
              >
                {localeText.buttons.exportExcel}
              </a>
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
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <InstantSearchField
                    name="attendanceQ"
                    label={details.filterAttendee}
                    defaultValue={attendanceSearchRaw}
                    placeholder={details.filterAttendee}
                    pageParams={["attendancePage"]}
                  />
                  <Link href={`/trainings/${run.id}`} className="secondary-button self-end">
                    {localeText.common.reset}
                  </Link>
                </div>
                {filteredAttendanceGridEnrollments.length === 0 ? (
                  <div className="mt-5 jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                    {localeText.common.noResults}
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
                        {visibleAttendanceGridEnrollments.map((nomination) => (
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
                {!showAllAttendance &&
                filteredAttendanceGridEnrollments.length > ATTENDANCE_PAGE_SIZE ? (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-[var(--ink-soft)]">
                      {localeText.pagination.pageIndicator
                        .replace("{current}", formatNumber(safeAttendancePage, numberLocale))
                        .replace("{total}", formatNumber(totalAttendancePages, numberLocale))}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={attendancePageHref(run.id, 1, attendanceSearchRaw)}
                        aria-disabled={safeAttendancePage <= 1}
                        className={`pagination-link ${safeAttendancePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                      >
                        {localeText.pagination.first}
                      </Link>
                      <Link
                        href={attendancePageHref(
                          run.id,
                          Math.max(1, safeAttendancePage - 1),
                          attendanceSearchRaw,
                        )}
                        aria-disabled={safeAttendancePage <= 1}
                        className={`pagination-link ${safeAttendancePage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                      >
                        {localeText.pagination.previous}
                      </Link>
                      {paginationPages(safeAttendancePage, totalAttendancePages).map((page, index) =>
                        page === "ellipsis" ? (
                          <span key={`attendance-ellipsis-${index}`} className="pagination-ellipsis">
                            ...
                          </span>
                        ) : (
                          <Link
                            key={page}
                            href={attendancePageHref(run.id, page, attendanceSearchRaw)}
                            aria-current={page === safeAttendancePage ? "page" : undefined}
                            className={`pagination-link ${page === safeAttendancePage ? "pagination-link-active" : ""}`}
                          >
                            {formatNumber(page, numberLocale)}
                          </Link>
                        ),
                      )}
                      <Link
                        href={attendancePageHref(
                          run.id,
                          Math.min(totalAttendancePages, safeAttendancePage + 1),
                          attendanceSearchRaw,
                        )}
                        aria-disabled={safeAttendancePage >= totalAttendancePages}
                        className={`pagination-link ${safeAttendancePage >= totalAttendancePages ? "pointer-events-none opacity-50" : ""}`}
                      >
                        {localeText.pagination.next}
                      </Link>
                      <Link
                        href={attendancePageHref(run.id, totalAttendancePages, attendanceSearchRaw)}
                        aria-disabled={safeAttendancePage >= totalAttendancePages}
                        className={`pagination-link ${safeAttendancePage >= totalAttendancePages ? "pointer-events-none opacity-50" : ""}`}
                      >
                        {localeText.pagination.last}
                      </Link>
                    </div>
                  </div>
                ) : null}
              </>
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
              {filteredCompletionRows.length > COMPLETION_PAGE_SIZE ? (
                <Link
                  href={
                    showAllCompletion
                      ? completionPageHref(run.id, 1, completionSearchRaw)
                      : completionPageHref(run.id, 1, completionSearchRaw, "all")
                  }
                  className="secondary-button"
                >
                  {showAllCompletion ? details.showPagedAttendance : details.seeAllAttendance}
                </Link>
              ) : null}
              <a
                href={`/api/trainings/${run.id}/completion/export`}
                className="secondary-button"
              >
                {localeText.buttons.exportExcel}
              </a>
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

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <InstantSearchField
                name="completionQ"
                label={details.filterAttendee}
                defaultValue={completionSearchRaw}
                placeholder={details.filterAttendee}
                pageParams={["completionPage"]}
              />
              <Link href={`/trainings/${run.id}`} className="secondary-button self-end">
                {localeText.common.reset}
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {completionRows.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noCompletionData}
                </div>
              ) : filteredCompletionRows.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {localeText.common.noResults}
                </div>
              ) : (
                visibleCompletionRows.map((row) => (
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

                    <div className="mt-4 border-t border-[var(--line)] pt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                        {details.sessionAttendanceDetail}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {row.sessionDetails.map((sessionDetail) => (
                          <div
                            key={sessionDetail.sessionId}
                            className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-[var(--ink-strong)]">
                              {new Intl.DateTimeFormat(numberLocale, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }).format(sessionDetail.sessionDate)}
                            </span>
                            <span className="status-pill">
                              {sessionDetail.attended ? details.attended : details.missed}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!showAllCompletion && filteredCompletionRows.length > COMPLETION_PAGE_SIZE ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--ink-soft)]">
                  {localeText.pagination.pageIndicator
                    .replace("{current}", formatNumber(safeCompletionPage, numberLocale))
                    .replace("{total}", formatNumber(totalCompletionPages, numberLocale))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={completionPageHref(run.id, 1, completionSearchRaw)}
                    aria-disabled={safeCompletionPage <= 1}
                    className={`pagination-link ${safeCompletionPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.first}
                  </Link>
                  <Link
                    href={completionPageHref(
                      run.id,
                      Math.max(1, safeCompletionPage - 1),
                      completionSearchRaw,
                    )}
                    aria-disabled={safeCompletionPage <= 1}
                    className={`pagination-link ${safeCompletionPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.previous}
                  </Link>
                  {paginationPages(safeCompletionPage, totalCompletionPages).map((page, index) =>
                    page === "ellipsis" ? (
                      <span key={`completion-ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={page}
                        href={completionPageHref(run.id, page, completionSearchRaw)}
                        aria-current={page === safeCompletionPage ? "page" : undefined}
                        className={`pagination-link ${page === safeCompletionPage ? "pagination-link-active" : ""}`}
                      >
                        {formatNumber(page, numberLocale)}
                      </Link>
                    ),
                  )}
                  <Link
                    href={completionPageHref(
                      run.id,
                      Math.min(totalCompletionPages, safeCompletionPage + 1),
                      completionSearchRaw,
                    )}
                    aria-disabled={safeCompletionPage >= totalCompletionPages}
                    className={`pagination-link ${safeCompletionPage >= totalCompletionPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.next}
                  </Link>
                  <Link
                    href={completionPageHref(run.id, totalCompletionPages, completionSearchRaw)}
                    aria-disabled={safeCompletionPage >= totalCompletionPages}
                    className={`pagination-link ${safeCompletionPage >= totalCompletionPages ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {localeText.pagination.last}
                  </Link>
                </div>
              </div>
            ) : null}
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
                <ProgressCard
                  label={details.vendorCost}
                  value={formatCurrency(trainingFinancials.vendorCost, numberLocale)}
                  tone="ink"
                />
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
                <a
                  href={`/api/trainings/${run.id}/evaluations/export`}
                  className="secondary-button"
                >
                  {localeText.buttons.exportExcel}
                </a>
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

                <input
                  type="hidden"
                  name="purchaseOrderCourseEntryId"
                  value={selectedPurchaseOrderCourseEntryId}
                />
                <div className="field-shell">
                  <span className="field-label">
                    {localeText.courseRuns.purchaseOrderCourseEntry}
                  </span>
                  <div className="field-input bg-[var(--surface-soft)] text-[var(--ink-soft)]">
                    {run.projectScopeCourse ? (
                      <>
                        {formatPurchaseOrderCode(run.projectScopeCourse.scope.code, locale)} |{" "}
                        {formatPurchaseOrderTitle(run.projectScopeCourse.scope, locale)} |{" "}
                        {run.projectScopeCourse.course.courseCode} |{" "}
                        {run.projectScopeCourse.course.nameEn ||
                          run.projectScopeCourse.course.nameAr}
                      </>
                    ) : (
                      localeText.courseRuns.selectPurchaseOrderCourseEntry
                    )}
                  </div>
                </div>

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
