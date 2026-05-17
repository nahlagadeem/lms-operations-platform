import { db } from "@/lib/db";

function toShortCourseCode(courseCode: string) {
  const match = courseCode.match(/^PKG-00([1-5])-(\d{4})$/);
  if (!match) return null;

  return `${match[1].padStart(2, "0")}-${String(Number(match[2])).padStart(3, "0")}`;
}

function toShortPackageCode(packageCode: string) {
  const match = packageCode.match(/^PKG-00([1-5])$/);
  if (!match) return null;

  return match[1].padStart(2, "0");
}

async function main() {
  const packages = await db.package.findMany({
    select: {
      id: true,
      code: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  const packageUpdates = packages
    .map((pkg) => ({
      id: pkg.id,
      oldCode: pkg.code,
      newCode: toShortPackageCode(pkg.code),
    }))
    .filter((pkg) => pkg.newCode && pkg.newCode !== pkg.oldCode);

  const courses = await db.course.findMany({
    select: {
      id: true,
      courseCode: true,
    },
    orderBy: {
      courseCode: "asc",
    },
  });

  const courseUpdates = courses
    .map((course) => ({
      id: course.id,
      oldCode: course.courseCode,
      newCode: toShortCourseCode(course.courseCode),
    }))
    .filter((course) => course.newCode && course.newCode !== course.oldCode);

  const runs = await db.courseRun.findMany({
    select: {
      id: true,
      runCode: true,
      startDate: true,
      course: {
        select: {
          courseCode: true,
        },
      },
    },
    orderBy: [{ course: { courseCode: "asc" } }, { startDate: "asc" }, { runCode: "asc" }],
  });

  const runNumberByCourse = new Map<string, number>();
  const runUpdates = runs
    .map((run) => {
      const courseCode = toShortCourseCode(run.course.courseCode) ?? run.course.courseCode;
      const dateToken =
        run.startDate?.toISOString().slice(0, 10).replaceAll("-", "") ??
        new Date().toISOString().slice(0, 10).replaceAll("-", "");
      const baseCode = `${courseCode}-${dateToken}`;
      const nextNumber = (runNumberByCourse.get(baseCode) ?? 0) + 1;
      runNumberByCourse.set(baseCode, nextNumber);

      return {
        id: run.id,
        oldCode: run.runCode,
        newCode: nextNumber === 1 ? baseCode : `${baseCode}-${String(nextNumber).padStart(2, "0")}`,
      };
    })
    .filter((run) => run.newCode !== run.oldCode);

  await db.$transaction(async (tx) => {
    for (const pkg of packageUpdates) {
      await tx.package.update({
        where: { id: pkg.id },
        data: { code: pkg.newCode! },
      });
    }

    for (const course of courseUpdates) {
      await tx.course.update({
        where: { id: course.id },
        data: { courseCode: course.newCode! },
      });
    }

    for (const run of runUpdates) {
      await tx.courseRun.update({
        where: { id: run.id },
        data: { runCode: `TEMP-${run.id}` },
      });
    }

    for (const run of runUpdates) {
      await tx.courseRun.update({
        where: { id: run.id },
        data: { runCode: run.newCode },
      });
    }
  });

  console.log(`Updated ${packageUpdates.length} package codes.`);
  console.log(`Updated ${courseUpdates.length} course codes.`);
  console.log(`Updated ${runUpdates.length} course run codes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
