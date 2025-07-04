
import { RequestCannonForm } from '@/components/request-cannon/request-cannon-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, LayoutDashboard, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6 md:px-8 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Rocket className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold text-primary hidden sm:block">Flooder L7</h1>
        </div>
        <div className="flex items-center gap-2">
            <Link href="/admin">
                <Button variant="outline">
                    <LayoutDashboard className="mr-2 h-4 w-4"/>
                    Dasbor Admin
                </Button>
            </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
        <Card className="w-full max-w-lg shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-headline text-primary">Flooder L7</CardTitle>
            <CardDescription className="text-muted-foreground">
              Konfigurasi dan luncurkan serangan banjir Layer 7 (HTTP). Tujuannya adalah untuk menguji ketahanan server target terhadap beban tinggi, yang berpotensi menyebabkannya merespons dengan kesalahan seperti 503 Bad Gateway, 502 Bad Gateway, 504 Gateway Timeout, atau menjadi tidak responsif. Gunakan secara bertanggung jawab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequestCannonForm />
          </CardContent>
        </Card>
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Flooder L7. Dibuat oleh Tirta Sadewa.</p>
        </footer>
      </main>
    </div>
  );
}
