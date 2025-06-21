
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Otentikasi telah dihapus, jadi middleware ini tidak lagi diperlukan.
// File ini disimpan agar tidak merusak build jika ada referensi, tetapi tidak melakukan apa-apa.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Matcher kosong berarti middleware ini tidak akan berjalan di path mana pun.
  matcher: [],
};
