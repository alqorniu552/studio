
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart2, Users, Settings, ShieldAlert, LayoutDashboard, History, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// Contoh data statis untuk riwayat serangan
const exampleAttackHistory = [
  {
    id: 1,
    dateTime: '2024-07-30 10:15:30',
    targetUrl: 'https://contoh-target.com',
    duration: '30d',
    requestsSent: 15000,
    successful: 14500,
    failed: 500,
    status: 'Selesai',
    statusIcon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
  {
    id: 2,
    dateTime: '2024-07-30 09:45:10',
    targetUrl: 'http://uji-lain.org',
    duration: '60d',
    requestsSent: 28000,
    successful: 5000,
    failed: 23000,
    status: 'Penuh Error',
    statusIcon: <XCircle className="h-4 w-4 text-red-500" />,
  },
  {
    id: 3,
    dateTime: '2024-07-29 18:20:05',
    targetUrl: 'https://situs-aman.net',
    duration: '10d',
    requestsSent: 4800,
    successful: 4700,
    failed: 100,
    status: 'Selesai',
    statusIcon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
  {
    id: 4,
    dateTime: '2024-07-29 11:05:00',
    targetUrl: 'https://internal.dev.local',
    duration: '5d',
    requestsSent: 0,
    successful: 0,
    failed: 0,
    status: 'Dibatalkan Pengguna',
    statusIcon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  },
];

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
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="mr-2 h-5 w-5" />
            Riwayat Serangan Terbaru (Contoh Data)
          </CardTitle>
          <CardDescription>
            Menampilkan ringkasan serangan yang telah dilakukan. Untuk data aktual, integrasi dengan penyimpanan data diperlukan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal & Waktu</TableHead>
                <TableHead>Target URL</TableHead>
                <TableHead className="text-center">Durasi</TableHead>
                <TableHead className="text-right">Terkirim</TableHead>
                <TableHead className="text-right">Sukses</TableHead>
                <TableHead className="text-right">Gagal</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exampleAttackHistory.map((attack) => (
                <TableRow key={attack.id}>
                  <TableCell className="font-medium">{attack.dateTime}</TableCell>
                  <TableCell>{attack.targetUrl}</TableCell>
                  <TableCell className="text-center">{attack.duration}</TableCell>
                  <TableCell className="text-right">{attack.requestsSent.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-500">{attack.successful.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-500">{attack.failed.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      {attack.statusIcon}
                      <span>{attack.status}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        
      <Card className="shadow-lg">
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
            <p className="text-sm text-muted-foreground">Tidak ada (perlu input manual jika digunakan)</p>
          </div>
            <div>
            <h4 className="font-medium">Batas Maksimum Konkurensi</h4>
            <p className="text-sm text-muted-foreground">500 permintaan/detik</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    