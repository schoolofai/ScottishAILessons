import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/chat', '/dashboard', '/session', '/admin'];
const authRoutes = ['/login', '/signup', '/reset-password'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // For now, disable middleware authentication checks since we're using client-side session management
  // The authentication is handled by the useAppwrite hook and localStorage.cookieFallback
  
  // Only block access to protected routes if explicitly requested
  // Let the client-side handle authentication state
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};