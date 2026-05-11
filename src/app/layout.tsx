import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
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
  title: "Training Portfolio Hub",
  description:
    "Internal training management platform for packages, courses, delivery planning, and reporting.",
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
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,#113449_0%,#0f5b65_45%,#e7f0dc_120%)] text-white shadow-[0_24px_80px_rgba(10,39,62,0.18)]">
            <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
              <div className="max-w-3xl">
                <p className="mb-3 inline-flex rounded-full border border-white/20 bg-white/12 px-4 py-1 text-sm font-medium text-white/90 backdrop-blur">
                  {localeText.shell.badge}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {localeText.shell.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                  {localeText.shell.subtitle}
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-3 lg:items-end">
                <nav className="flex flex-wrap gap-2 lg:justify-end">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-[#10394d]"
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
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
