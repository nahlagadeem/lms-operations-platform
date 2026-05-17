import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "lms_ops_auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";
  const isAuthenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === "admin";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", pathname);

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
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
