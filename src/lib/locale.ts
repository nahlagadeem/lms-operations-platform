import { cookies } from "next/headers";

export const LOCALE_COOKIE_NAME = "lms_ops_locale";

export type Locale = "en" | "ar";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  return locale === "ar" ? "ar" : "en";
}

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "ar";
}

export function t(locale: Locale) {
  return locale === "ar" ? arabicText : englishText;
}

const englishText = {
  nav: {
    home: "Home",
    packages: "Packages",
    courses: "Courses",
    courseRuns: "Ongoing courses",
  },
  language: {
    label: "Language",
    english: "English",
    arabic: "العربية",
  },
  shell: {
    badge: "Training Portfolio Hub",
    title: "Training Management & Delivery Platform",
    subtitle:
      "Track packages, courses, schedules, operations, and execution status from one internal platform instead of scattered Excel files.",
  },
  home: {
    packageCount: "Total packages",
    importedCourses: "Imported courses",
    targetTrainees: "Target trainees",
    activeRuns: "Active course deliveries",
    activeRunsHint: "Number of live delivery records being managed",
    unavailable: "Not available",
    catalogSnapshot: "Catalog Snapshot",
    packageSummary: "Training package summary",
    viewAllPackages: "View all packages",
    packageCode: "Package code",
    packageName: "Package name",
    courseCount: "Courses",
    target: "Target",
    discountedValue: "Discounted value",
    nextSteps: "Next Steps",
    nextPhase: "What comes next",
    stepOneTitle: "Packages and courses foundation",
    stepOneDescription:
      "The database and initial import are ready, and the catalog is now available for browsing and filtering.",
    stepTwoTitle: "Course run operations",
    stepTwoDescription:
      "The next build stage is course run management for schedules, venues, trainers, and operational status.",
    stepThreeTitle: "Operational reporting",
    stepThreeDescription:
      "After course runs, the system will expand into attendance, nominations, daily tracking, and reporting.",
    totalDiscountedValue: "Total discounted portfolio value",
    quickAccess: "Quick Access",
    packagesTitle: "Package management",
    packagesDescription:
      "Review packages, course counts per package, and the core values imported from the project workbook.",
    coursesTitle: "Course directory",
    coursesDescription:
      "Browse the full course catalog with search, package filters, and delivery type filters.",
  },
  packages: {
    eyebrow: "Packages",
    title: "Training packages",
    description:
      "Imported project packages with course counts, trainee targets, and planning values.",
    goToCourses: "Go to courses",
    active: "Active",
    courseCount: "Course count",
    target: "Target trainees",
  },
  courseRuns: {
    eyebrow: "Ongoing courses",
    title: "Ongoing courses",
    description:
      "Manage actual scheduled courses, including dates, venues, trainers, nominations, attendance, and course status.",
    createTitle: "Add an ongoing course",
    createDescription:
      "Create a scheduled course entry linked to one course from the catalog, then continue with trainers, students, and attendance.",
    course: "Course",
    selectCourse: "Select a course",
    deliveryMode: "Delivery mode",
    status: "Status",
    startDate: "Start date",
    endDate: "End date",
    plannedSeats: "Planned seats",
    notes: "Notes",
    notesPlaceholder: "Internal operational notes",
    createAction: "Add course",
    listTitle: "Ongoing courses list",
    listDescription: "Review ongoing and scheduled courses, then filter them by package, status, or keyword.",
    search: "Search",
    searchPlaceholder: "Course code or course name",
    filterPackage: "Package",
    filterStatus: "Status",
    allPackages: "All packages",
    allStatuses: "All statuses",
    applyFilters: "Apply filters",
    resetFilters: "Reset",
    runCode: "Course code",
    packageName: "Package",
    courseName: "Course",
    dates: "Dates",
    mode: "Mode",
    seats: "Seats",
    noDates: "Dates not set",
    noRunsTitle: "No ongoing courses matched the current filters.",
    noRunsDescription:
      "Add a first course entry or adjust the filters to see the scheduling data here.",
    totalRuns: "Total course records",
    plannedRuns: "Planned courses",
    ongoingRuns: "Ongoing courses",
    completedRuns: "Completed courses",
    emptyTitle: "No course records have been created yet.",
    emptyDescription:
      "The catalog is ready. The next step is creating course records for schedules, trainers, students, and operations.",
    buildPlanTitle: "This module will include",
    buildPlanOne: "Scheduling and run status tracking",
    buildPlanTwo: "Venue, provider, and trainer assignment",
    buildPlanThree: "Attendance, nominations, and operational reporting",
  },
  courses: {
    eyebrow: "Courses",
    title: "Course directory",
    description:
      "Browse the imported course catalog with search, filtering, and server-side pagination.",
    backToPackages: "Back to packages",
    search: "Search",
    searchPlaceholder: "Course name or code",
    package: "Package",
    allPackages: "All packages",
    deliveryType: "Program type",
    allTypes: "All types",
    apply: "Apply",
    reset: "Reset",
    results: "Current results",
    showing: "Showing",
    to: "to",
    fromTotal: "of",
    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",
    code: "Code",
    name: "Course",
    category: "Category",
    type: "Type",
    duration: "Duration",
    finalPrice: "Final price",
    unspecified: "Unspecified",
    unavailable: "Not available",
    noResults: "No courses matched the current filters.",
    filterSummary:
      "Refine the results using search, package, or program type to find the right set.",
  },
  deliveryModes: {
    IN_PERSON: "In person",
    ONLINE: "Online",
    HYBRID: "Hybrid",
    ABROAD: "Abroad",
  },
  courseRunStatuses: {
    DRAFT: "Draft",
    PLANNED: "Planned",
    APPROVAL_PENDING: "Approval pending",
    OPEN_FOR_NOMINATION: "Open for nomination",
    CONFIRMED: "Confirmed",
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
    CANCELED: "Canceled",
    POSTPONED: "Postponed",
    CLOSED: "Closed",
  },
  deliveryTypes: {
    TRAINING: "Training program",
    CERTIFICATION: "Professional certification",
    LANGUAGE: "Language program",
    CONFERENCE: "Conference",
    WORKSHOP: "Workshop",
  },
  units: {
    day: "day",
    days: "days",
    hour: "hour",
    hours: "hours",
  },
} as const;

const arabicText = {
  nav: {
    home: "الرئيسية",
    packages: "الحزم",
    courses: "الدورات",
    courseRuns: "التشغيل",
  },
  language: {
    label: "اللغة",
    english: "English",
    arabic: "العربية",
  },
  shell: {
    badge: "LMS Operations Platform",
    title: "منصة إدارة عمليات التدريب",
    subtitle:
      "متابعة الحزم والدورات والجداول والتشغيل والحالة التنفيذية من منصة داخلية واحدة بدل ملفات Excel المتفرقة.",
  },
  home: {
    packageCount: "إجمالي الحزم",
    importedCourses: "إجمالي الدورات المستوردة",
    targetTrainees: "إجمالي المستهدف من المتدربين",
    activeRuns: "إجمالي التشغيل الحالي",
    activeRunsHint: "عدد النسخ التشغيلية للدورات",
    unavailable: "غير متوفر",
    catalogSnapshot: "ملخص البيانات",
    packageSummary: "ملخص الحزم التدريبية",
    viewAllPackages: "عرض جميع الحزم",
    packageCode: "رمز الحزمة",
    packageName: "اسم الحزمة",
    courseCount: "عدد الدورات",
    target: "المستهدف",
    discountedValue: "القيمة بعد الخصم",
    nextSteps: "المرحلة التالية",
    nextPhase: "ما الذي سنبنيه بعد ذلك",
    stepOneTitle: "أساس الحزم والدورات",
    stepOneDescription:
      "تم تجهيز قاعدة البيانات والاستيراد الأولي، وأصبحت بيانات الكتالوج جاهزة للتصفح والفلترة.",
    stepTwoTitle: "تشغيل الدورات الفعلية",
    stepTwoDescription:
      "المرحلة التالية هي إدارة التشغيل الفعلي للدورات بما يشمل الجداول، المواقع، المدربين، والحالة التنفيذية.",
    stepThreeTitle: "التقارير التشغيلية",
    stepThreeDescription:
      "بعد بناء التشغيل الفعلي سنضيف الحضور، الترشيحات، المتابعة اليومية، والتقارير.",
    totalDiscountedValue: "إجمالي قيمة المحفظة بعد الخصومات",
    quickAccess: "الوصول السريع",
    packagesTitle: "إدارة الحزم",
    packagesDescription:
      "مراجعة الحزم وعدد الدورات داخل كل حزمة والقيم الأساسية المستوردة من ملف المشروع.",
    coursesTitle: "دليل الدورات",
    coursesDescription:
      "تصفح دليل الدورات مع البحث والتصفية حسب الحزمة ونوع البرنامج.",
  },
  packages: {
    eyebrow: "الحزم",
    title: "الحزم التدريبية",
    description:
      "الحزم المستوردة من ملف المشروع مع أعداد الدورات والمستهدف والقيم التخطيطية الأساسية.",
    goToCourses: "الانتقال إلى الدورات",
    active: "نشطة",
    courseCount: "عدد الدورات",
    target: "المستهدف",
  },
  courseRuns: {
    eyebrow: "التشغيل",
    title: "تشغيل الدورات",
    description:
      "هذه الوحدة ستدير النسخ التشغيلية الفعلية للدورات بما يشمل التواريخ والمواقع والمدربين والحالة التنفيذية.",
    createTitle: "إنشاء نسخة تشغيلية",
    createDescription:
      "ابدأ جدولة التنفيذ الفعلي عبر إنشاء نسخة تشغيلية مرتبطة بإحدى الدورات من الكتالوج.",
    course: "الدورة",
    selectCourse: "اختر دورة",
    deliveryMode: "نمط التنفيذ",
    status: "الحالة",
    startDate: "تاريخ البداية",
    endDate: "تاريخ النهاية",
    plannedSeats: "المقاعد المخططة",
    notes: "ملاحظات",
    notesPlaceholder: "ملاحظات تشغيلية داخلية",
    createAction: "إنشاء التشغيل",
    listTitle: "النسخ التشغيلية المجدولة",
    listDescription: "راجع التشغيلات التي تم إنشاؤها وقم بفلترتها حسب الحزمة أو الحالة أو الكلمة المفتاحية.",
    search: "بحث",
    searchPlaceholder: "كود التشغيل أو اسم الدورة",
    filterPackage: "الحزمة",
    filterStatus: "الحالة",
    allPackages: "كل الحزم",
    allStatuses: "كل الحالات",
    applyFilters: "تطبيق",
    resetFilters: "إعادة ضبط",
    runCode: "كود التشغيل",
    packageName: "الحزمة",
    courseName: "الدورة",
    dates: "التواريخ",
    mode: "النمط",
    seats: "المقاعد",
    noDates: "التواريخ غير محددة",
    noRunsTitle: "لا توجد نسخ تشغيلية مطابقة للفلترة الحالية.",
    noRunsDescription:
      "أنشئ أول تشغيل أو عدل الفلاتر لعرض بيانات الجدولة التشغيلية هنا.",
    totalRuns: "إجمالي التشغيل",
    plannedRuns: "المخطط لها",
    ongoingRuns: "الجارية",
    completedRuns: "المكتملة",
    emptyTitle: "لا توجد نسخ تشغيلية للدورات حتى الآن.",
    emptyDescription:
      "الكتالوج جاهز. الخطوة التالية هي إنشاء سجلات التشغيل الخاصة بالجدولة والمدربين والتنفيذ.",
    buildPlanTitle: "هذه الوحدة ستشمل",
    buildPlanOne: "الجدولة وتتبع الحالة التشغيلية",
    buildPlanTwo: "إسناد الموقع والجهة والمدرب",
    buildPlanThree: "الحضور والترشيحات والتقارير التشغيلية",
  },
  courses: {
    eyebrow: "الدورات",
    title: "دليل الدورات",
    description: "تصفح الدورات المستوردة مع البحث والتصفية والتنقل بين الصفحات.",
    backToPackages: "العودة إلى الحزم",
    search: "بحث",
    searchPlaceholder: "اسم الدورة أو الكود",
    package: "الحزمة",
    allPackages: "كل الحزم",
    deliveryType: "نوع البرنامج",
    allTypes: "كل الأنواع",
    apply: "تطبيق",
    reset: "إعادة ضبط",
    results: "النتائج الحالية",
    showing: "عرض",
    to: "إلى",
    fromTotal: "من أصل",
    page: "الصفحة",
    of: "من",
    previous: "السابق",
    next: "التالي",
    code: "الكود",
    name: "اسم الدورة",
    category: "التصنيف",
    type: "النوع",
    duration: "المدة",
    finalPrice: "السعر النهائي",
    unspecified: "غير محددة",
    unavailable: "غير متوفر",
    noResults: "لا توجد دورات مطابقة للفلترة الحالية.",
    filterSummary:
      "يمكنك تعديل البحث أو الحزمة أو نوع البرنامج للوصول إلى نتائج مختلفة.",
  },
  deliveryModes: {
    IN_PERSON: "حضوري",
    ONLINE: "عن بعد",
    HYBRID: "هجين",
    ABROAD: "خارج المملكة",
  },
  courseRunStatuses: {
    DRAFT: "مسودة",
    PLANNED: "مخطط لها",
    APPROVAL_PENDING: "بانتظار الاعتماد",
    OPEN_FOR_NOMINATION: "مفتوحة للترشيح",
    CONFIRMED: "مؤكدة",
    ONGOING: "جارية",
    COMPLETED: "مكتملة",
    CANCELED: "ملغاة",
    POSTPONED: "مؤجلة",
    CLOSED: "مغلقة",
  },
  deliveryTypes: {
    TRAINING: "برنامج تدريبي",
    CERTIFICATION: "شهادة احترافية",
    LANGUAGE: "برنامج لغة",
    CONFERENCE: "مؤتمر",
    WORKSHOP: "ورشة عمل",
  },
  units: {
    day: "يوم",
    days: "أيام",
    hour: "ساعة",
    hours: "ساعات",
  },
} as const;
