
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';
import { cookies } from 'next/headers';

const protectedRoutes = ['/admin'];
const publicRoutes = ['/admin/login'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((prefix) => path.startsWith(prefix)) && !publicRoutes.includes(path);

  if (isProtectedRoute) {
    const cookie = cookies().get('admin_session')?.value;
    const session = await decrypt(cookie);

    if (!session?.username) {
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
