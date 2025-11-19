import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/chat', '/dashboard', '/session', '/admin'];
const authRoutes = ['/login', '/signup', '/reset-password'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Check for Appwrite session cookies
  // Client SDK uses: a_session_{projectId} pattern
  // Server SDK uses: appwrite_session
  const allCookies = request.cookies.getAll();
  const appwriteClientSession = allCookies.find(c => c.name.startsWith('a_session_'));
  const appwriteServerSession = request.cookies.get('appwrite_session');

  const hasSession = Boolean(
    (appwriteClientSession?.value) ||
    (appwriteServerSession?.value)
  );

  // Debug logging for auth routes
  if (isProtectedRoute || isAuthRoute) {
    console.log('[Middleware] Auth check:', {
      pathname,
      isProtectedRoute,
      isAuthRoute,
      hasSession,
      clientSession: appwriteClientSession?.name || 'none',
      serverSession: appwriteServerSession?.value ? 'present' : 'none',
      allCookies: allCookies.map(c => c.name)
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