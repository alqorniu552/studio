'use server';

import { cookies } from 'next/headers';
import { getAdminAuth } from './firebase-server';

// Creates a session cookie.
export async function createSessionCookie(idToken: string) {
  try {
    const adminAuth = getAdminAuth(); // This might throw an error if not configured
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    cookies().set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn,
      path: '/',
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error creating session cookie:', error);
    // Return the specific error message to be displayed in the UI
    return { success: false, error: error.message };
  }
}

// Signs out.
export async function signOut() {
  cookies().delete('session');
  return { success: true };
}
