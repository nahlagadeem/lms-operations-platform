"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderNavLinkProps = {
  href: string;
  label: string;
  variant: "desktop" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNavLink({ href, label, variant }: HeaderNavLinkProps) {
  const pathname = usePathname() || "/";
  const isActive = isActivePath(pathname, href);

  if (variant === "mobile") {
    return (
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`min-h-11 rounded-[8px] border-b-2 px-3 py-3 text-sm font-semibold text-[var(--brand-ink)] transition hover:border-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-soft)] ${
          isActive
            ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow-soft)]"
            : "border-transparent"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:border-[var(--brand-yellow)] ${
        isActive ? "border-[var(--brand-yellow)]" : "border-transparent"
      }`}
    >
      {label}
    </Link>
  );
}
