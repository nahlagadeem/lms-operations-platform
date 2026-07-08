import type { Locale } from "@/lib/locale";

function normalize(value?: string | null) {
  return value?.trim() || "";
}

function looksLikeGenericScopeName(value: string) {
  const lower = value.toLowerCase();

  return (
    lower === "scope" ||
    lower.startsWith("scope ") ||
    lower.startsWith("project scope") ||
    lower.startsWith("purchase order") ||
    lower.startsWith("نطاق") ||
    lower.startsWith("أمر الشراء") ||
    lower.startsWith("أمر شراء")
  );
}

function formatCodeSegment(code?: string | null) {
  const cleanCode = normalize(code);
  if (!cleanCode) return "";
  if (/^(po|أمر الشراء|أمر شراء)\b/i.test(cleanCode)) return cleanCode;
  if (/^\d+$/.test(cleanCode)) return String(Number(cleanCode));
  return cleanCode;
}

export function formatPurchaseOrderCode(code?: string | null, locale: Locale = "en") {
  const codeSegment = formatCodeSegment(code);
  if (!codeSegment) {
    return locale === "ar" ? "أمر الشراء" : "PO";
  }

  if (/^(po|أمر الشراء|أمر شراء)\b/i.test(codeSegment)) {
    return codeSegment;
  }

  return `${locale === "ar" ? "أمر الشراء" : "PO"} ${codeSegment}`;
}

export function formatPurchaseOrderTitle(
  input: {
    code?: string | null;
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
  },
  locale: Locale,
) {
  const rawName =
    locale === "ar"
      ? normalize(input.nameAr || input.nameEn || input.name)
      : normalize(input.nameEn || input.nameAr || input.name);
  const cleanName = rawName || normalize(input.code);

  if (/^(po|أمر الشراء|أمر شراء)\b/i.test(cleanName)) {
    return cleanName;
  }

  if (looksLikeGenericScopeName(cleanName)) {
    return formatPurchaseOrderCode(input.code, locale);
  }

  return `${locale === "ar" ? "أمر الشراء" : "PO"} ${cleanName}`.trim();
}
