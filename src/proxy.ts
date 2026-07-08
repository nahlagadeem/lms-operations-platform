import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "lms_ops_auth";
const RAW_PLATFORM_ROLE_COOKIE_VALUES = new Set([
  "PROJECT_MANAGER",
  "KEY_STAKEHOLDER",
  "DATA_ENTRY",
  "CUSTOMER",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";
  const sessionValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const hasSessionCookie =
    Boolean(sessionValue) &&
    !RAW_PLATFORM_ROLE_COOKIE_VALUES.has(sessionValue ?? "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", pathname);

  if (!hasSessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
