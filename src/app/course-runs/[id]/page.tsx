import Link from "next/link";
import { notFound } from "next/navigation";
import {
  assignTrainerToCourseRun,
  createParticipantAndNominate,
  nominateExistingParticipant,
  recordAttendance,
  removeTrainerFromCourseRun,
  updateCourseRun,
  updateNominationStatus,
} from "@/app/course-runs/actions";
import { db } from "@/lib/db";
import { getLocale, t } from "@/lib/locale";

type CourseRunDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    panel?: string;
  }>;
};

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function detailText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      title: "تفاصيل التشغيل",
      description:
        "راجع معلومات التشغيل الحالية، ثم استخدم الأزرار العلوية لتعديل التشغيل أو إضافة مدرب أو إدارة الترشيحات.",
      edit: "تعديل التشغيل",
      editButton: "فتح تعديل التشغيل",
      addTrainer: "إضافة مدرب",
      addTrainerButton: "فتح إضافة مدرب",
      addNomination: "إضافة ترشيح",
      addNominationButton: "فتح إضافة ترشيح",
      addAttendance: "تسجيل حضور",
      addAttendanceButton: "فتح تسجيل الحضور",
      summary: "الملخص",
      progress: "مؤشرات التقدم",
      provider: "الجهة المنفذة",
      location: "الموقع",
      chooseProvider: "اختر جهة",
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
      nominations: "الترشيحات",
      currentNominations: "الترشيحات الحالية",
      chooseParticipant: "اختر مستفيداً",
      nominationStatus: "حالة الترشيح",
      participantType: "نوع المستفيد",
      participantNameAr: "الاسم بالعربية",
      participantNameEn: "الاسم بالإنجليزية",
      participantEmail: "البريد الإلكتروني",
      participantPhone: "الجوال",
      participantOrg: "الجهة",
      participantJobTitle: "المسمى الوظيفي",
      participantNationalId: "رقم الهوية / الإقامة",
      existingParticipant: "ترشيح من سجل موجود",
      quickCreateParticipant: "إضافة مستفيد جديد وترشيحه",
      noNominations: "لا توجد ترشيحات حتى الآن",
      saveNomination: "حفظ الترشيح",
      createAndNominate: "إضافة وترشيح",
      attendance: "الحضور",
      attendanceLog: "سجل الحضور",
      noAttendance: "لا توجد سجلات حضور حتى الآن",
      attendanceDate: "تاريخ الحضور",
      attendanceStatus: "حالة الحضور",
      chooseAttendee: "اختر متدرباً مرشحاً",
      saveAttendance: "حفظ الحضور",
      recordedAttendance: "الحضور المسجل",
      completion: "الاكتمال والأهلية",
      completionSummary: "ملخص الاكتمال",
      noCompletionData: "لا توجد بيانات حضور كافية لحساب الاكتمال حتى الآن",
      attendanceRate: "نسبة الحضور",
      attendedDays: "أيام الحضور",
      totalSessions: "إجمالي الجلسات",
      completionEligible: "مؤهل للاكتمال",
      certificateEligible: "مؤهل للشهادة",
      completionRule: "يعتبر المتدرب مؤهلاً عند حضور 75% على الأقل من الجلسات المسجلة.",
      eligibleCount: "المؤهلون",
      threshold: "حد الاكتمال",
      documents: "المستندات",
      attendanceRequired: "يتطلب حضور",
      certificateRequired: "يتطلب شهادة",
      confirmedSeats: "المقاعد المؤكدة",
      yes: "نعم",
      no: "لا",
      close: "إغلاق",
      plannedSeats: "المقاعد المخططة",
      courseStatus: "حالة التشغيل",
    };
  }

  return {
    title: "Course run details",
    description:
      "Review the current delivery information first, then use the top actions to edit the delivery, add a trainer, or manage nominations.",
    edit: "Edit delivery",
    editButton: "Open edit form",
    addTrainer: "Add trainer",
    addTrainerButton: "Open add trainer",
    addNomination: "Add nomination",
    addNominationButton: "Open add nomination",
    addAttendance: "Record attendance",
    addAttendanceButton: "Open attendance form",
    summary: "Summary",
    progress: "Progress indicators",
    provider: "Provider",
    location: "Location",
    chooseProvider: "Choose a provider",
    chooseLocation: "Choose a location",
    save: "Save changes",
    back: "Back",
    notAssigned: "Not assigned yet",
    noNotes: "No notes provided",
    trainerAssignments: "Trainer assignments",
    currentTrainers: "Current trainers",
    chooseTrainer: "Choose a trainer",
    trainerRole: "Trainer role",
    trainerRolePlaceholder: "Lead trainer or supporting trainer",
    primaryTrainer: "Primary trainer",
    noTrainers: "No trainers are assigned yet",
    remove: "Remove",
    nominations: "Nominations",
    currentNominations: "Current nominations",
    chooseParticipant: "Choose a participant",
    nominationStatus: "Nomination status",
    participantType: "Participant type",
    participantNameAr: "Arabic name",
    participantNameEn: "English name",
    participantEmail: "Email",
    participantPhone: "Phone number",
    participantOrg: "Organization",
    participantJobTitle: "Job title",
    participantNationalId: "National ID / Iqama",
    existingParticipant: "Nominate from existing participants",
    quickCreateParticipant: "Create a new participant and nominate",
    noNominations: "No nominations have been added yet",
    saveNomination: "Save nomination",
    createAndNominate: "Create and nominate",
    attendance: "Attendance",
    attendanceLog: "Attendance log",
    noAttendance: "No attendance records have been added yet",
    attendanceDate: "Attendance date",
    attendanceStatus: "Attendance status",
    chooseAttendee: "Choose a nominated attendee",
    saveAttendance: "Save attendance",
    recordedAttendance: "Recorded attendance",
    completion: "Completion and eligibility",
    completionSummary: "Completion summary",
    noCompletionData: "There is not enough attendance data to calculate completion yet",
    attendanceRate: "Attendance rate",
    attendedDays: "Attended days",
    totalSessions: "Total sessions",
    completionEligible: "Completion eligible",
    certificateEligible: "Certificate eligible",
    completionRule: "A student is considered eligible when they attend at least 75% of the recorded sessions.",
    eligibleCount: "Eligible students",
    threshold: "Completion threshold",
    documents: "Documents",
    attendanceRequired: "Attendance required",
    certificateRequired: "Certificate required",
    confirmedSeats: "Confirmed seats",
    yes: "Yes",
    no: "No",
    close: "Close",
    plannedSeats: "Planned seats",
    courseStatus: "Delivery status",
  };
}

function nominationStatusText(locale: "en" | "ar") {
  if (locale === "ar") {
    return {
      NOMINATED: "مرشح",
      CONTACTED: "تم التواصل",
      CONFIRMED: "مؤكد",
      DECLINED: "معتذر",
      REPLACED: "مستبدل",
      WITHDRAWN: "منسحب",
    } as const;
  }

  return {
    NOMINATED: "Nominated",
    CONTACTED: "Contacted",
    CONFIRMED: "Confirmed",
    DECLINED: "Declined",
    REPLACED: "Replaced",
    WITHDRAWN: "Withdrawn",
  } as const;
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
    STUDENT: "Student",
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

function panelHref(id: string, panel: "edit" | "trainer" | "nomination" | "attendance") {
  return `/course-runs/${id}?panel=${panel}`;
}

export default async function CourseRunDetailPage({
  params,
  searchParams,
}: CourseRunDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const openPanel =
    query.panel === "edit" ||
    query.panel === "trainer" ||
    query.panel === "nomination" ||
    query.panel === "attendance"
      ? query.panel
      : "";
  const locale = await getLocale();
  const localeText = t(locale);
  const details = detailText(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const completionThreshold = 0.75;

  const [run, providers, locations, trainers, participants] = await Promise.all([
    db.courseRun.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            package: true,
            category: true,
          },
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
          take: 20,
        },
        _count: {
          select: {
            nominations: true,
            documents: true,
            attendanceRecords: true,
          },
        },
      },
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
  ]);

  if (!run) notFound();

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
      totalSessions: 0,
      attendanceRate: 0,
      completionEligible: false,
      certificateEligible: false,
    };

    existing.totalSessions += 1;

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

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/course-runs"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-ink)] hover:underline"
            >
              <span aria-hidden="true">←</span>
              <span>{details.back}</span>
            </Link>
            <p className="eyebrow">{details.title}</p>
            <h2 className="section-title">
              {run.runCode} | {run.course.nameEn || run.course.nameAr}
            </h2>
            <p className="section-copy">{details.description}</p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Link href={panelHref(run.id, "edit")} className="primary-button min-w-fit whitespace-nowrap px-4 text-center text-sm">
              {details.edit}
            </Link>
            <Link
              href={panelHref(run.id, "trainer")}
              className="secondary-button min-w-fit whitespace-nowrap px-4 text-center text-sm"
            >
              {details.addTrainer}
            </Link>
            <Link
              href={panelHref(run.id, "nomination")}
              className="secondary-button min-w-fit whitespace-nowrap px-4 text-center text-sm"
            >
              {details.addNomination}
            </Link>
            <Link
              href={panelHref(run.id, "attendance")}
              className="secondary-button min-w-fit whitespace-nowrap px-4 text-center text-sm"
            >
              {details.addAttendance}
            </Link>
          </div>
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

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.nominations}</p>
                <h3 className="section-title">{details.currentNominations}</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {run.nominations.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noNominations}
                </div>
              ) : (
                run.nominations.map((nomination) => (
                  <div
                    key={nomination.id}
                    className="jawraa-subcard flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink-strong)]">
                        {nomination.participant.fullNameEn || nomination.participant.fullNameAr}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {nomination.participant.email ||
                          nomination.participant.organizationName ||
                          participantTypeText(locale)[nomination.participant.participantType]}
                      </p>
                    </div>

                    <form action={updateNominationStatus} className="w-full sm:w-auto">
                      <input type="hidden" name="courseRunId" value={run.id} />
                      <input type="hidden" name="nominationId" value={nomination.id} />
                      <select
                        name="nominationStatus"
                        defaultValue={nomination.nominationStatus}
                        className="field-input min-w-[14rem]"
                      >
                        {Object.entries(nominationStatusText(locale)).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="secondary-button mt-2 w-full sm:w-auto">
                        {details.save}
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel-surface">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow">{details.attendance}</p>
                <h3 className="section-title">{details.attendanceLog}</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {run.attendanceRecords.length === 0 ? (
                <div className="jawraa-subcard border-dashed px-4 py-4 text-sm text-[var(--ink-soft)]">
                  {details.noAttendance}
                </div>
              ) : (
                run.attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="jawraa-subcard flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink-strong)]">
                        {record.participant.fullNameEn || record.participant.fullNameAr}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {new Intl.DateTimeFormat(numberLocale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }).format(record.attendanceDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="status-pill">
                        {attendanceStatusText(locale)[record.attendanceStatus]}
                      </span>
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

                    <form action={removeTrainerFromCourseRun}>
                      <input type="hidden" name="courseRunId" value={run.id} />
                      <input type="hidden" name="trainerId" value={assignment.trainerId} />
                      <button type="submit" className="secondary-button w-full sm:w-auto">
                        {details.remove}
                      </button>
                    </form>
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
                label={details.nominations}
                value={formatNumber(run._count.nominations, numberLocale)}
                tone="teal"
              />
              <ProgressCard
                label={details.documents}
                value={formatNumber(run._count.documents, numberLocale)}
                tone="sand"
              />
              <ProgressCard
                label={details.recordedAttendance}
                value={formatNumber(run._count.attendanceRecords, numberLocale)}
                tone="teal"
              />
              <ProgressCard
                label={details.plannedSeats}
                value={
                  run.plannedSeats !== null
                    ? formatNumber(run.plannedSeats, numberLocale)
                    : "-"
                }
                tone="ink"
              />
              <ProgressCard
                label={details.confirmedSeats}
                value={formatNumber(run.confirmedSeats, numberLocale)}
                tone="sand"
              />
              <ProgressCard
                label={details.courseStatus}
                value={localeText.courseRunStatuses[run.status]}
                tone="teal"
              />
            </div>
          </div>
        </div>
      </section>

      {openPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,25,35,0.55)] p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_30px_70px_rgba(10,25,35,0.35)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">
                  {openPanel === "edit"
                    ? details.edit
                    : openPanel === "trainer"
                      ? details.addTrainer
                      : details.addNomination}
                </p>
                <h3 className="section-title">
                  {openPanel === "edit"
                    ? details.editButton
                    : openPanel === "trainer"
                      ? details.addTrainerButton
                      : openPanel === "nomination"
                        ? details.addNominationButton
                        : details.addAttendanceButton}
                </h3>
              </div>
              <Link href={`/course-runs/${run.id}`} className="secondary-button">
                {details.close}
              </Link>
            </div>

            {openPanel === "edit" ? (
              <form action={updateCourseRun} className="space-y-4">
                <input type="hidden" name="courseRunId" value={run.id} />

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
                      name="providerId"
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

                <label className="field-shell">
                  <span className="field-label">{localeText.courseRuns.plannedSeats}</span>
                  <input
                    type="number"
                    name="plannedSeats"
                    min="0"
                    step="1"
                    className="field-input"
                    defaultValue={run.plannedSeats ?? ""}
                  />
                </label>

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
            ) : openPanel === "trainer" ? (
              <form action={assignTrainerToCourseRun} className="space-y-4">
                <input type="hidden" name="courseRunId" value={run.id} />

                <label className="field-shell">
                  <span className="field-label">{details.addTrainer}</span>
                  <select name="trainerId" className="field-input" defaultValue="">
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
            ) : openPanel === "nomination" ? (
              <div className="space-y-6">
                <form action={nominateExistingParticipant} className="space-y-4">
                  <input type="hidden" name="courseRunId" value={run.id} />

                  <div>
                    <p className="eyebrow">{details.existingParticipant}</p>
                  </div>

                  <label className="field-shell">
                    <span className="field-label">{details.chooseParticipant}</span>
                    <select name="participantId" className="field-input" defaultValue="">
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
                        name="nominationStatus"
                        className="field-input"
                        defaultValue="NOMINATED"
                      >
                        {Object.entries(nominationStatusText(locale)).map(([key, label]) => (
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

                <form action={createParticipantAndNominate} className="space-y-4">
                  <input type="hidden" name="courseRunId" value={run.id} />

                  <div>
                    <p className="eyebrow">{details.quickCreateParticipant}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="field-shell">
                      <span className="field-label">{details.participantType}</span>
                      <select
                        name="participantType"
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
                        name="nominationStatus"
                        className="field-input"
                        defaultValue="NOMINATED"
                      >
                        {Object.entries(nominationStatusText(locale)).map(([key, label]) => (
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
            ) : (
              <form action={recordAttendance} className="space-y-4">
                <input type="hidden" name="courseRunId" value={run.id} />

                <label className="field-shell">
                  <span className="field-label">{details.chooseAttendee}</span>
                  <select name="participantId" className="field-input" defaultValue="">
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
                    <span className="field-label">{details.attendanceDate}</span>
                    <input type="date" name="attendanceDate" className="field-input" />
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
