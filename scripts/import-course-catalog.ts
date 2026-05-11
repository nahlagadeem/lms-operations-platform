import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const workbookPath = process.argv[2];

async function main() {
  if (!workbookPath) {
    console.error("Missing workbook path.");
    console.error("Usage: npm run import:catalog -- <path-to-xlsx>");
    process.exit(1);
  }

  try {
    const { loadWorkbookFromExcel } = await import(
      "../src/server/importers/course-catalog-importer"
    );
    const result = await loadWorkbookFromExcel(workbookPath);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Import failed.");
    console.error(error);
    process.exit(1);
  }
}

main();
