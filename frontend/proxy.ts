import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE_KEY } from "@/lib/authSession.constants";

export function proxy(request: NextRequest) {
  const hasAuthSession = request.cookies.get(AUTH_SESSION_COOKIE_KEY)?.value === "1";

  if (hasAuthSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth";
  loginUrl.search = "";

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/content/:path*", "/feed/:path*", "/settings/:path*"],
};
