'use server';

import { cookies } from 'next/headers';
import { adminAuth } from './firebase-server';

// Creates a session cookie.
export async function createSessionCookie(idToken: string) {
  try {
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn,
      path: '/',
    });
    return { success: true };
  } catch (error) {
    console.error('Error creating session cookie:', error);
    return { success: false };
  }
}

// Signs out.
export async function signOut() {
  cookies().delete('session');
  return { success: true };
}
