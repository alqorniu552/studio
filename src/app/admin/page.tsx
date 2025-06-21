
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Info } from 'lucide-react';

export default async function AdminDashboardPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <Shield className="mr-3 h-8 w-8" />
          Panel Administratif
        </h1>
      </div>
      <p className="text-muted-foreground">
        Halaman ini untuk tugas-tugas administratif. Fitur otentikasi dan manajemen pengguna telah dihapus.
      </p>

      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="mr-2 h-5 w-5"/>
              Status Sistem
            </CardTitle>
            <CardDescription>
              Fungsionalitas otentikasi telah dihapus dari aplikasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <p>Semua halaman, termasuk dasbor ini dan dasbor pengguna, sekarang dapat diakses secara publik tanpa perlu login.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
