
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isProtectedRoute = pathname === '/' || pathname === '/admin';

  // If the user is logged in and trying to access a login/register page,
  // redirect them to the home page.
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If the user is not logged in and trying to access a protected page,
  // redirect them to the login page.
  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Otherwise, allow the request to proceed.
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/login', '/register'],
};
