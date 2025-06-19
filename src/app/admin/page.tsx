import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Users, Settings, ShieldAlert, LayoutDashboard } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <LayoutDashboard className="mr-3 h-8 w-8" />
          Dasbor Administrator
        </h1>
        {/* Tombol atau aksi lain bisa ditambahkan di sini */}
      </div>
      <p className="text-muted-foreground">
        Selamat datang di panel administrasi Meriam Permintaan.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Serangan (Contoh)</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +20.1% dari bulan lalu
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proxy Aktif (Contoh)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">573</div>
            <p className="text-xs text-muted-foreground">
              +180.1% dari minggu lalu
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peringatan Keamanan (Contoh)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Perlu tinjauan segera
            </p>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 lg:col-span-3 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              Pengaturan Sistem (Contoh)
            </CardTitle>
            <CardDescription>
              Beberapa pengaturan global aplikasi akan ditampilkan di sini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">Mode Pemeliharaan</h4>
              <p className="text-sm text-muted-foreground">Status: <span className="text-green-500 font-semibold">Nonaktif</span></p>
            </div>
            <div>
              <h4 className="font-medium">URL API Proksi Default</h4>
              <p className="text-sm text-muted-foreground">api.contohproxy.com/list.txt</p>
            </div>
             <div>
              <h4 className="font-medium">Batas Maksimum Konkurensi</h4>
              <p className="text-sm text-muted-foreground">500 permintaan/detik</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
