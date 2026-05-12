"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Locale = "en" | "ar";

const LOCALE_COOKIE_NAME = "lms_ops_locale";

type LanguageSwitcherProps = {
  currentLocale: Locale;
  englishLabel: string;
  arabicLabel: string;
};

function setLocaleCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function LanguageSwitcher({
  currentLocale,
  englishLabel,
  arabicLabel,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticLocale, setOptimisticLocale] =
    useOptimistic<Locale>(currentLocale);
  const indicatorPosition =
    optimisticLocale === "ar"
      ? currentLocale === "ar"
        ? "-translate-x-full"
        : "translate-x-full"
      : "translate-x-0";

  const query = searchParams.toString();
  const redirectPath = query ? `${pathname}?${query}` : pathname;

  function handleChange(nextLocale: Locale) {
    if (nextLocale === optimisticLocale) {
      return;
    }

    setLocaleCookie(nextLocale);

    startTransition(() => {
      setOptimisticLocale(nextLocale);
      router.replace(redirectPath);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-grid grid-cols-2 self-start overflow-hidden rounded-full border border-black/10 bg-white p-1 text-sm font-semibold shadow-[0_10px_24px_rgba(17,17,17,0.08)] lg:self-auto">
      <span
        className={`pointer-events-none absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-full bg-[var(--brand-yellow)] shadow-[0_8px_20px_rgba(244,195,24,0.25)] transition-transform duration-300 ease-out ${indicatorPosition}`}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => handleChange("en")}
        disabled={isPending}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          optimisticLocale === "en" ? "text-[var(--brand-ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--brand-yellow-soft)]"
        }`}
      >
        {englishLabel}
      </button>

      <button
        type="button"
        onClick={() => handleChange("ar")}
        disabled={isPending}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          optimisticLocale === "ar" ? "text-[var(--brand-ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--brand-yellow-soft)]"
        }`}
      >
        {arabicLabel}
      </button>
    </div>
  );
}
