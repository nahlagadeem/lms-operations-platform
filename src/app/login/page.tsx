import { cookies } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale, t } from "@/lib/locale";

const AUTH_COOKIE_NAME = "lms_ops_auth";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function login(formData: FormData) {
  "use server";

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (username !== "admin" || password !== "admin") {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "admin", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const localeText = t(locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <section className="w-full max-w-sm rounded-[8px] border border-[var(--brand-yellow)] bg-white p-6 shadow-[0_18px_44px_rgba(17,17,17,0.06)]">
        <div className="mb-6 flex flex-col gap-5">
          <Image
            src="/jawraa-logo.svg"
            alt="JAWRAA"
            width={151}
            height={28}
            priority
            className="h-auto w-[151px]"
            style={{ height: "auto" }}
          />
          <LanguageSwitcher
            currentLocale={locale}
            englishLabel={localeText.language.english}
            arabicLabel={localeText.language.arabic}
          />
          <h1 className="mt-2 text-2xl font-bold text-[var(--ink-strong)]">
            Login
          </h1>
        </div>

        {params.error ? (
          <p className="mb-4 rounded-[8px] border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Username or password is incorrect.
          </p>
        ) : null}

        <form action={login} className="space-y-4">
          <label className="field-shell">
            <span className="field-label">Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              className="field-input"
            />
          </label>

          <label className="field-shell">
            <span className="field-label">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="field-input"
            />
          </label>

          <button type="submit" className="primary-button w-full">
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
