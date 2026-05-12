import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getDirection, getLocale, t } from "@/lib/locale";
import "./globals.css";

const arabicFont = IBM_Plex_Sans_Arabic({
  variable: "--font-app-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const latinFont = IBM_Plex_Sans({
  variable: "--font-app-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "JAWRAA",
  description:
    "Internal training management system for packages, courses, scheduling, operations, and reporting.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const direction = getDirection(locale);
  const localeText = t(locale);

  const navigationItems = [
    { href: "/", label: localeText.nav.home },
    { href: "/packages", label: localeText.nav.packages },
    { href: "/courses", label: localeText.nav.courses },
    { href: "/course-runs", label: localeText.nav.courseRuns },
    {
      href: "/providers",
      label: locale === "ar" ? "الجهات" : "Providers",
    },
    {
      href: "/locations",
      label: locale === "ar" ? "المواقع" : "Locations",
    },
  ];

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${arabicFont.variable} ${latinFont.variable} h-full antialiased`}
    >
      <body
        className="min-h-full bg-[var(--surface-base)] text-[var(--ink-strong)]"
        data-locale={locale}
      >
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-8 sm:px-10 lg:px-16">
          <header className="mb-12 bg-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <Link href="/" className="flex w-fit shrink-0 items-center">
                <Image
                  src="/jawraa-logo.svg"
                  alt="JAWRAA"
                  width={151}
                  height={28}
                  priority
                  className="h-auto w-[151px]"
                />
              </Link>

              <nav className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 lg:justify-center">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap border-b-2 border-transparent px-1 py-2 text-sm font-semibold text-[var(--brand-ink)] transition hover:border-[var(--brand-yellow)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <LanguageSwitcher
                currentLocale={locale}
                englishLabel={localeText.language.english}
                arabicLabel={localeText.language.arabic}
              />
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
