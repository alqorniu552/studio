
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
  const isProtectedRoute = pathname === '/' || pathname.startsWith('/admin');

  // Jika sudah login dan mencoba mengakses halaman login/register, arahkan ke dasbor admin
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // Jika belum login dan mencoba mengakses halaman yang dilindungi, arahkan ke login
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Izinkan permintaan jika tidak ada aturan yang cocok
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Terapkan middleware ke semua rute ini
    '/',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};
