
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Server, Clock } from 'lucide-react';

// Mock data for demonstration
const systemStats = {
  activeUsers: 1, // The admin
  runningAttacks: 0,
  serverLoad: '15%',
  uptime: '99.98%',
};

const recentAdminActions = [
    { id: 1, action: 'Sistem dimulai ulang', timestamp: '2 jam yang lalu' },
    { id: 2, action: 'Konfigurasi batas laju diperbarui', timestamp: '5 jam yang lalu' },
    { id: 3, action: 'Peringatan keamanan diselesaikan', timestamp: '1 hari yang lalu' },
];

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
        Selamat datang di dasbor admin. Pantau kesehatan sistem dan kelola pengaturan dari sini.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pengguna Aktif</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{systemStats.activeUsers}</div>
                  <p className="text-xs text-muted-foreground">Sesi admin yang sedang aktif</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Beban Server</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{systemStats.serverLoad}</div>
                  <p className="text-xs text-muted-foreground">Penggunaan CPU saat ini</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Waktu Aktif Sistem</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{systemStats.uptime}</div>
                  <p className="text-xs text-muted-foreground">Sejak restart terakhir</p>
              </CardContent>
          </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Log Aktivitas Admin Terbaru</CardTitle>
            <CardDescription>
              Menampilkan tindakan administratif terbaru yang tercatat dalam sistem.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <ul className="space-y-2">
                {recentAdminActions.map(item => (
                    <li key={item.id} className="flex justify-between items-center text-sm border-b pb-1">
                        <span>{item.action}</span>
                        <span className="text-muted-foreground">{item.timestamp}</span>
                    </li>
                ))}
             </ul>
          </CardContent>
        </Card>
    </div>
  );
}
