
import type {Metadata} from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dasbor Pengguna - Flooder L7',
  description: 'Dasbor pengguna untuk Flooder L7.',
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6 md:px-8 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-bold text-primary">Dasbor Pengguna</h1>
          <div className="flex items-center gap-2">
              <Link href="/">
                  <Button variant="outline">
                      <Home className="mr-2 h-4 w-4"/>
                      Home
                  </Button>
              </Link>
              <Link href="/admin">
                  <Button variant="ghost">
                      <Shield className="mr-2 h-4 w-4"/>
                      Admin
                  </Button>
              </Link>
          </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </>
  );
}
