import { NextRequest, NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE_NAME } from "@/lib/locale";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const redirectPath = url.searchParams.get("redirect") || "/";
  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (isLocale(locale)) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
