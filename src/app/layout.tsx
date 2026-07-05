import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeaderNavLink } from "@/components/header-nav-link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { isAuthenticated } from "@/lib/auth";
import { getDirection, getLocale, t } from "@/lib/locale";
import { getCurrentPlatformRole, isCustomerCapacityOnly } from "@/lib/permissions";
import "./globals.css";

const AUTH_COOKIE_NAME = "lms_ops_auth";

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
    "Training services management platform for courses, trainings, attendees, vendors, locations, and reports.",
  icons: {
    icon: "/jawraa-logo.svg",
    shortcut: "/jawraa-logo.svg",
    apple: "/jawraa-logo.svg",
  },
};

async function logout() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  redirect("/login");
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const currentPath = headerStore.get("x-current-path") || "";
  const locale = await getLocale();
  const direction = getDirection(locale);
  const localeText = t(locale);
  const isLoginPage = currentPath === "/login";
  const authenticated = await isAuthenticated();
  const platformRole = await getCurrentPlatformRole();
  const customerOnly = isCustomerCapacityOnly(platformRole);

  if (currentPath && !authenticated && !isLoginPage) {
    redirect("/login");
  }

  if (currentPath && authenticated && isLoginPage) {
    redirect("/");
  }

  const navigationItems = customerOnly
    ? [
        { href: "/", label: localeText.nav.home },
        { href: "/trainings", label: localeText.nav.courseRuns },
        { href: "/packages", label: localeText.nav.packages },
        { href: "/courses", label: localeText.nav.courses },
      ]
    : [
        { href: "/", label: localeText.nav.home },
        { href: "/pos", label: localeText.nav.projectScope },
        { href: "/trainings", label: localeText.nav.courseRuns },
        { href: "/project-details", label: localeText.nav.projectDetails },
        { href: "/packages", label: localeText.nav.packages },
        { href: "/courses", label: localeText.nav.courses },
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
        {isLoginPage ? (
          children
        ) : (
          <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-6 sm:px-6 lg:px-10 xl:px-14">
            <header className="mb-8 bg-white lg:mb-10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between gap-4">
                  <Link href="/" className="flex w-fit shrink-0 items-center">
                    <Image
                      src="/jawraa-logo.svg"
                      alt="JAWRAA"
                      width={151}
                      height={28}
                      priority
                      className="h-auto w-[151px]"
                      style={{ height: "auto" }}
                    />
                  </Link>
                </div>

                <details className="nav-menu lg:hidden">
                  <summary className="secondary-button cursor-pointer select-none">
                    {localeText.nav.menu}
                  </summary>
                  <nav className="mt-3 grid gap-2 rounded-[8px] border border-[var(--brand-yellow)] bg-white p-3 shadow-[0_18px_44px_rgba(17,17,17,0.12)]">
                    {navigationItems.map((item) => (
                      <HeaderNavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        variant="mobile"
                      />
                    ))}
                    <form action={logout}>
                      <button type="submit" className="secondary-button w-full">
                        {localeText.nav.logout}
                      </button>
                    </form>
                  </nav>
                </details>

                <nav className="hidden min-w-0 flex-wrap gap-x-5 gap-y-2 lg:flex lg:justify-center">
                  {navigationItems.map((item) => (
                    <HeaderNavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      variant="desktop"
                    />
                  ))}
                </nav>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <LanguageSwitcher
                    currentLocale={locale}
                    englishLabel={localeText.language.english}
                    arabicLabel={localeText.language.arabic}
                  />
                  <form action={logout}>
                    <button type="submit" className="secondary-button w-full lg:w-auto">
                      {localeText.nav.logout}
                    </button>
                  </form>
                </div>
              </div>
            </header>

            <main className="flex-1">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
