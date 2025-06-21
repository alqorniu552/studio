
'use server';

import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Kunci Rahasia JWT tidak diatur dalam variabel lingkungan.');
  }
  return new TextEncoder().encode(secret);
};


interface SessionPayload {
  username: string;
  expires: Date;
}

export async function encrypt(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Sesi berakhir dalam 1 hari
    .sign(getSecretKey());
}

export async function decrypt(session: string | undefined = '') {
  if (!session) {
    return null;
  }
  try {
    const { payload } = await jwtVerify<SessionPayload>(session, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    // Ini bisa berupa token kedaluwarsa, token tidak valid, dll.
    console.error('Gagal mendekripsi sesi:', error);
    return null;
  }
}

export async function createSession(username: string) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 hari dari sekarang
  const session = await encrypt({ username, expires });

  cookies().set('admin_session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expires,
    path: '/',
  });
}

export async function getSession() {
  const cookie = cookies().get('admin_session')?.value;
  const session = await decrypt(cookie);
  return session;
}

export async function deleteSession() {
  cookies().delete('admin_session');
}

export async function protectedRoute() {
  const session = await getSession();
  if (!session) {
    redirect('/admin/login');
  }
  return session;
}
