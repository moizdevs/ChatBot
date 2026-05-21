import { NextResponse } from "next/server"

export async function proxy(request) {
  const token = request.cookies.get("next-auth.session-token")?.value
  const url = request.nextUrl.clone()

  // If user has a token and is trying to access /login, redirect to /
  if (token && url.pathname === "/login") {
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // If user has no token and is trying to access /, redirect to /login
  if (!token && url.pathname === "/") {
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Otherwise, allow access
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login"]
}