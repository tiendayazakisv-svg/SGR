import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sgr_session";

export async function updateSession(request: NextRequest) {
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isDashboard && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLogin && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request,
  });
}
