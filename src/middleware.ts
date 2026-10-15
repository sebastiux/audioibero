import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PAGES = ["/login", "/registro"];

/** Redirige a /login si no hay sesión. Los permisos finos (admin) se revisan en servidor con la BD. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PAGES.includes(pathname);

  if (!session && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (session && (isPublic || pathname === "/")) return NextResponse.redirect(new URL("/calendario", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
