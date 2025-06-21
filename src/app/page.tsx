
import { RequestCannonForm } from '@/components/request-cannon/request-cannon-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Rocket className="h-12 w-12 text-primary" />
          </div>
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
  );
}
