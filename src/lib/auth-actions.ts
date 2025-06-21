'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

// --- Types and Schemas ---
const LoginCredentialsSchema = z.object({
  email: z.string().email({ message: "Format email tidak valid." }),
  password: z.string().min(1, { message: "Password harus diisi." }),
});
type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

const RegisterCredentialsSchema = z.object({
  email: z.string().email({ message: "Format email tidak valid." }),
  password: z.string().min(6, { message: "Password minimal 6 karakter." }),
});
type RegisterCredentials = z.infer<typeof RegisterCredentialsSchema>;


const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
});
type User = z.infer<typeof UserSchema>;

type ActionResult = {
  success: boolean;
  error?: string;
};

// --- Database Helpers ---
const dbPath = path.join(process.cwd(), 'data', 'users.json');

async function readUsers(): Promise<User[]> {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, it's the first run
      return [];
    }
    console.error("Gagal membaca database pengguna:", error);
    throw new Error("Tidak dapat mengakses database pengguna.");
  }
}

async function writeUsers(users: User[]): Promise<void> {
  try {
    await fs.writeFile(dbPath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error("Gagal menulis ke database pengguna:", error);
    throw new Error("Gagal menyimpan data pengguna.");
  }
}

// --- Session Management ---
const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

async function encrypt(payload: any) {
  if (!secretKey) {
    throw new Error('JWT_SECRET tidak diatur di file .env.local. Sesi tidak aman.');
  }
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5d') // Sesi berlaku selama 5 hari
    .sign(key);
}

// --- Auth Actions ---

export async function login(credentials: LoginCredentials): Promise<ActionResult> {
  const parsed = LoginCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { email, password } = parsed.data;

  try {
    const users = await readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, error: 'Email atau password salah.' };
    }

    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordsMatch) {
      return { success: false, error: 'Email atau password salah.' };
    }

    // Create session
    const expires = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const sessionPayload = { user: { id: user.id, email: user.email }, expires };
    const session = await encrypt(sessionPayload);

    cookies().set('session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

    return { success: true };
  } catch (error: any) {
    console.error("Kesalahan Login:", error);
    return { success: false, error: "Terjadi kesalahan internal. Silakan coba lagi." };
  }
}

export async function register(credentials: RegisterCredentials): Promise<ActionResult> {
  const parsed = RegisterCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { email, password } = parsed.data;

  try {
    const users = await readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'Email sudah terdaftar.' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
    };

    users.push(newUser);
    await writeUsers(users);
    
    return { success: true };
  } catch (error: any) {
    console.error("Kesalahan Registrasi:", error);
    return { success: false, error: "Terjadi kesalahan internal. Silakan coba lagi." };
  }
}

export async function signOut() {
  cookies().set('session', '', { expires: new Date(0), path: '/' });
}
