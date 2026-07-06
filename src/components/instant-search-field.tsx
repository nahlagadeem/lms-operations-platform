"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

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
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const updateSearch = useCallback(
    (nextValue: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      const trimmedValue = nextValue.trim();

      if (trimmedValue) {
        nextParams.set(name, trimmedValue);
      } else {
        nextParams.delete(name);
      }

      pageParams.forEach((pageParam) => nextParams.delete(pageParam));

      const query = nextParams.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [name, pageParams, pathname, router, searchParams],
  );

  return (
    <label className="field-shell">
      <span className="field-label">{label}</span>
      <input
        type="search"
        name={name}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          updateSearch(nextValue);
        }}
        placeholder={placeholder}
        className="field-input"
      />
    </label>
  );
}
