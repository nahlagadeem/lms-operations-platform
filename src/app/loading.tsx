import { getLocale } from "@/lib/locale";

export default async function Loading() {
  const locale = await getLocale();
  const text = locale === "ar" ? "جاري تحميل المنصة..." : "Loading platform...";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-base)] px-5">
      <section className="flex w-full max-w-sm flex-col items-center rounded-[8px] border border-[rgba(17,17,17,0.08)] bg-white px-6 py-8 text-center shadow-[0_18px_44px_rgba(17,17,17,0.08)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--brand-yellow-soft)] border-t-[var(--brand-yellow)]" />
        <p className="mt-5 text-sm font-semibold text-[var(--ink-strong)]">
          {text}
        </p>
      </section>
    </main>
  );
}
