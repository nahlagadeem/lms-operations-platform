"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type InstantSearchFieldProps = {
  name?: string;
  label: string;
  defaultValue?: string;
  placeholder: string;
  pageParams?: string[];
};

export function InstantSearchField({
  name = "q",
  label,
  defaultValue = "",
  placeholder,
  pageParams = ["page"],
}: InstantSearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();
  const pageParamKey = useMemo(() => pageParams.join("|"), [pageParams]);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(window.location.search);
      const trimmedValue = value.trim();
      const currentValue = nextParams.get(name) ?? "";

      if (currentValue === trimmedValue) return;

      if (trimmedValue) {
        nextParams.set(name, trimmedValue);
      } else {
        nextParams.delete(name);
      }

      pageParamKey.split("|").forEach((pageParam) => nextParams.delete(pageParam));

      const query = nextParams.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl === currentUrl) return;

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [name, pageParamKey, pathname, router, startTransition, value]);

  return (
    <label className="field-shell">
      <span className="field-label">{label}</span>
      <input
        type="search"
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </label>
  );
}
