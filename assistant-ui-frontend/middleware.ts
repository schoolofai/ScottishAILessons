import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/chat', '/dashboard', '/session', '/admin'];
const authRoutes = ['/login', '/signup', '/reset-password'];
const SESSION_COOKIE = 'appwrite_session';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Check for session cookie
  const session = request.cookies.get(SESSION_COOKIE);
  const hasSession = Boolean(session?.value);

  // Debug logging for auth routes
  if (isProtectedRoute || isAuthRoute) {
    console.log('[Middleware] Auth check:', {
      pathname,
      isProtectedRoute,
      isAuthRoute,
      hasSession,
      cookieValue: session?.value ? `${session.value.substring(0, 10)}...` : 'none',
      allCookies: request.cookies.getAll().map(c => c.name)
    });
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};