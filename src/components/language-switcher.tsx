"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [optimisticLocale, setOptimisticLocale] = useState<Locale>(currentLocale);

  useEffect(() => {
    setOptimisticLocale(currentLocale);
  }, [currentLocale]);

  const query = searchParams.toString();
  const redirectPath = query ? `${pathname}?${query}` : pathname;

  function handleChange(nextLocale: Locale) {
    if (nextLocale === optimisticLocale) {
      return;
    }

    setOptimisticLocale(nextLocale);
    setLocaleCookie(nextLocale);

    startTransition(() => {
      router.replace(redirectPath);
      router.refresh();
    });
  }

  return (
    <div className="relative inline-grid grid-cols-2 self-start rounded-full border border-white/15 bg-white/10 p-1 text-sm font-medium lg:self-end">
      <span
        className={`pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-[#e7f0dc] shadow-[0_8px_20px_rgba(10,39,62,0.18)] transition-transform duration-300 ease-out ${
          optimisticLocale === "ar" ? "translate-x-full" : "translate-x-0"
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={() => handleChange("en")}
        disabled={isPending}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          optimisticLocale === "en" ? "text-[#10394d]" : "text-white hover:bg-white/10"
        }`}
      >
        {englishLabel}
      </button>

      <button
        type="button"
        onClick={() => handleChange("ar")}
        disabled={isPending}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          optimisticLocale === "ar" ? "text-[#10394d]" : "text-white hover:bg-white/10"
        }`}
      >
        {arabicLabel}
      </button>
    </div>
  );
}
