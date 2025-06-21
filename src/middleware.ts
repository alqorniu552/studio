
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// This function checks if the user is authenticated
async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET tidak diatur. Verifikasi sesi akan gagal.');
    return false;
  }

  try {
    const key = new TextEncoder().encode(secret);
    await jwtVerify(token, key, { algorithms: ['HS256'] });
    return true;
  } catch (error) {
    console.log('Verifikasi sesi gagal:', error);
    return false;
  }
}


export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const isLoggedIn = await verifySession(session);
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/register';
  // Protected routes now include /dashboard and /admin
  const isProtectedRoute = pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  // If already logged in and trying to access login/register, redirect to the user dashboard
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If not logged in and trying to access a protected route, redirect to login
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow the request if no rules match
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply middleware to all these routes
    '/',
    '/admin/:path*',
    '/dashboard/:path*', // Added dashboard path
    '/login',
    '/register',
  ],
};
