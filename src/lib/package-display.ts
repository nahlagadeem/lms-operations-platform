import type { Locale } from "@/lib/locale";

function normalize(value?: string | null) {
  return value?.trim() || "";
}

export function formatPackageDisplayName(
  input: {
    code?: string | null;
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
  },
  locale: Locale,
) {
  const label = locale === "ar" ? "الحزمة" : "Package";
  const code = normalize(input.code);
  const name =
    locale === "ar"
      ? normalize(input.nameAr || input.nameEn || input.name)
      : normalize(input.nameEn || input.nameAr || input.name);

  if (!code && !name) {
    return label;
  }

  if (!name) {
    return `${label} ${code}`.trim();
  }

  if (!code) {
    return `${label} ${name}`.trim();
  }

  return `${label} ${code}  ${name}`;
}
