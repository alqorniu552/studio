
'use server';

import { redirect } from 'next/navigation';
import { createSession, deleteSession } from '@/lib/session';

export async function adminLogin(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    await createSession(username);
    redirect('/admin');
  }

  return {
    error: 'Username atau password tidak valid.',
  };
}

export async function adminLogout() {
  await deleteSession();
  redirect('/admin/login');
}
