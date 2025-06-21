import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value || '';

  const protectedRoutes = ['/', '/admin'];
  const authRoutes = ['/login', '/register'];
  const currentPath = request.nextUrl.pathname;

  // If no session, redirect to login for protected routes
  if (!session && protectedRoutes.includes(currentPath)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If there's a session, try to verify it
  if (session) {
    try {
      // Decode to check expiration without calling verifySessionCookie which makes a network request
      // This is a lightweight check. For full validation, a backend call would be needed.
      // For this implementation, we assume if the cookie exists, it's valid until it's checked on a server component/action.
      const response = NextResponse.next();
      
      // If user is authenticated and tries to access login/register, redirect to home
      if (authRoutes.includes(currentPath)) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      
      return response;
    } catch (error) {
       // Invalid session, redirect to login and clear cookie
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin', '/login', '/register'],
};
