'use server';

import { redirect } from 'next/navigation';
import { createSession, deleteSession } from '@/lib/session';
import fs from 'fs/promises';
import path from 'path';
import bcryptjs from 'bcryptjs';
import { revalidatePath } from 'next/cache';

// Admin Login/Logout (using environment variables)
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

// User Management (using data/users.json)
const usersFilePath = path.join(process.cwd(), 'data', 'users.json');

interface User {
  id: string;
  username: string;
  hashedPassword?: string;
  createdAt: string;
}

async function readUsers(): Promise<User[]> {
  try {
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    if (fileContent.trim() === '') {
        return [];
    }
    return JSON.parse(fileContent) as User[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to read or parse users.json:', error);
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
}

export async function getUsers(): Promise<Omit<User, 'hashedPassword'>[]> {
  const users = await readUsers();
  return users.map(({ hashedPassword, ...user }) => user);
}

export async function createUser(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username dan password diperlukan.' };
  }
  if (password.length < 6) {
    return { error: 'Password harus memiliki setidaknya 6 karakter.' };
  }

  try {
    const users = await readUsers();
    const existingUser = users.find((user) => user.username.toLowerCase() === username.toLowerCase());

    if (existingUser) {
      return { error: 'Username sudah digunakan.' };
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const newUser: User = {
      id: new Date().toISOString() + '-' + Math.random().toString(36).substring(2),
      username,
      hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    revalidatePath('/admin');
    return { success: `Pengguna '${username}' berhasil dibuat.` };
  } catch (error) {
    console.error('Gagal membuat pengguna:', error);
    return { error: 'Terjadi kesalahan internal. Gagal menyimpan pengguna.' };
  }
}
