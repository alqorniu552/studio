import type {Metadata} from 'next';
import '../globals.css'; // Menggunakan globals.css yang sama
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Dasbor Admin - Meriam Permintaan',
  description: 'Halaman administrasi untuk Meriam Permintaan.',
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col bg-background">
        {/* Di sini bisa ditambahkan header atau sidebar khusus admin di masa depan */}
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
