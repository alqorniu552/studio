
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Settings, ShieldAlert, LayoutDashboard, History, CheckCircle, XCircle, AlertTriangle, Power, FileClock, Zap, 
  Target as TargetIcon, Server as ServerIcon, RotateCw, Wifi, Globe, BarChartHorizontal, Briefcase, Info, Users, UserPlus
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { startFloodAttack, type FloodStats, getUserIpAddress, getUsers } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { AddUserForm } from './_components/add-user-form';

// Interfaces
interface AttackHistoryEntry {
  id: string;
  dateTime: string;
  targetUrl: string;
  method: string;
  duration: number;
  requestsSent: number;
  successful: number;
  failed: number;
  status: string;
  error?: string;
  statusCodeCounts?: Record<number, number>;
}

const HTTP_METHODS_BASE = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;
const ATTACK_HISTORY_STORAGE_KEY = "flooderL7AttackHistory";

interface AutoAttackLogEntry {
  timestamp: string;
  target: string;
  method: string;
  totalSent?: number;
  successful?: number;
  failed?: number;
  error?: string;
  statusText: string;
}

interface User {
  id: string;
  username: string;
  createdAt: string;
}

const getStatusIcon = (status: string, error?: string): React.ReactElement => {
    if (error || status.toLowerCase() === "gagal") return <XCircle className="h-4 w-4 text-red-500" />;
    if (status.toLowerCase() === "selesai") return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
};

type ChartData = {
  name: string;
  successful: number;
  failed: number;
};

const chartConfig = {
  successful: {
    label: "Sukses",
    color: "hsl(var(--chart-2))",
  },
  failed: {
    label: "Gagal",
    color: "hsl(var(--chart-5))",
  },
};

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [isAutoAttackEnabled, setIsAutoAttackEnabled] = useState(false);
  const [autoAttackTargetUrl, setAutoAttackTargetUrl] = useState("");
  const [autoAttackMethod, setAutoAttackMethod] = useState<typeof HTTP_METHODS_BASE[number]>("GET");
  const [autoAttackProxyApiUrl, setAutoAttackProxyApiUrl] = useState("");
  const [autoAttackStatus, setAutoAttackStatus] = useState("Nonaktif");
  const [autoAttackLogs, setAutoAttackLogs] = useState<AutoAttackLogEntry[]>([]);
  const [isAttacking, setIsAttacking] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [manualAttackHistory, setManualAttackHistory] = useState<AttackHistoryEntry[]>([]);
  const [userIp, setUserIp] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);
  const [isFetchingIp, setIsFetchingIp] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState<string[]>([]);
  const [activeProxyCount, setActiveProxyCount] = useState<number | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const fetchUsers = useCallback(async () => {
    const fetchedUsers = await getUsers();
    setUsers(fetchedUsers);
  }, []);

  useEffect(() => {
    fetchUsers();

    const storedHistory = localStorage.getItem(ATTACK_HISTORY_STORAGE_KEY);
    let parsedHistory: AttackHistoryEntry[] = [];
    if (storedHistory) {
      try {
        const history = JSON.parse(storedHistory);
        if (Array.isArray(history)) {
          parsedHistory = history;
          setManualAttackHistory(history);
        }
      } catch (e) {
        console.error("Gagal mengurai riwayat serangan dari localStorage:", e);
      }
    }

    if (parsedHistory.length > 0) {
      const dataForChart = parsedHistory
        .slice(0, 5)
        .reverse()
        .map(attack => ({
          name: new Date(attack.id).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          successful: attack.successful,
          failed: attack.failed,
        }));
      setChartData(dataForChart);
    }
    
    const fetchIp = async () => {
      setIsFetchingIp(true);
      const result = await getUserIpAddress();
      if (result.ip) {
        setUserIp(result.ip);
      } else {
        setIpError(result.error || "Alamat IP tidak dapat ditentukan.");
      }
      setIsFetchingIp(false);
    };
    fetchIp();
  }, [fetchUsers]);

  useEffect(() => {
    const analyzeHistoryForAlerts = (history: AttackHistoryEntry[], logs: AutoAttackLogEntry[]): string[] => {
      const alerts: Set<string> = new Set();
      const alertThreshold = 0.5;

      const getHostname = (url: string) => {
        try {
          return new URL(url).hostname;
        } catch (e) {
          return url;
        }
      };

      history.forEach(attack => {
        if (attack.requestsSent > 20 && !attack.error) {
          const statusCodes = attack.statusCodeCounts || {};
          let wafCount = (statusCodes[403] || 0) + (statusCodes[429] || 0);
          let serverErrorCount = 0;
          Object.entries(statusCodes).forEach(([code, count]) => {
            if (parseInt(code) >= 500 && parseInt(code) < 600) {
              serverErrorCount += count;
            }
          });
          if ((wafCount / attack.requestsSent) > alertThreshold) alerts.add(`Potensi WAF pada ${getHostname(attack.targetUrl)}`);
          if ((serverErrorCount / attack.requestsSent) > alertThreshold) alerts.add(`Server tidak stabil pada ${getHostname(attack.targetUrl)}`);
        } else if (attack.error) {
            alerts.add(`Serangan ke ${getHostname(attack.targetUrl)} gagal`);
        }
      });

      logs.forEach(log => {
        if (log.error) alerts.add(`Otomatis: Gagal menyerang ${getHostname(log.target)}`);
      });

      return Array.from(alerts).slice(0, 3);
    };

    const newAlerts = analyzeHistoryForAlerts(manualAttackHistory, autoAttackLogs);
    setSecurityAlerts(newAlerts);
  }, [manualAttackHistory, autoAttackLogs]);

  const addAutoAttackLogEntry = useCallback((logEntry: Omit<AutoAttackLogEntry, 'timestamp'>) => {
    const newEntry = { ...logEntry, timestamp: new Date().toLocaleString('id-ID') };
    setAutoAttackLogs(prev => [newEntry, ...prev.slice(0, 4)]);
  }, []);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith("http://") || url.startsWith("https://");
    } catch (_) {
      return false;
    }
  };

  const runSingleAutoAttack = useCallback(async () => {
    if (!validateUrl(autoAttackTargetUrl)) {
      toast({ variant: "destructive", title: "URL Target Tidak Valid", description: "Harap masukkan URL yang valid untuk serangan otomatis." });
      setIsAutoAttackEnabled(false);
      return;
    }
    if (!autoAttackProxyApiUrl.trim()) {
        toast({ variant: "destructive", title: "URL API Proksi Diperlukan", description: "Serangan otomatis memerlukan URL API proksi." });
        setIsAutoAttackEnabled(false);
        return;
    }

    setIsAttacking(true);
    setAutoAttackStatus(`Menyerang ${autoAttackTargetUrl} (${autoAttackMethod})...`);
    
    try {
      const result = await startFloodAttack(autoAttackTargetUrl, autoAttackMethod, undefined, undefined, 50, 100, 15, undefined, autoAttackProxyApiUrl.trim() ? autoAttackProxyApiUrl : undefined);
      if (result.proxiesUsed !== undefined) setActiveProxyCount(result.proxiesUsed);
      const statusText = result.error ? `Error: ${result.error}` : `Selesai. Terkirim: ${result.totalSent}, Sukses: ${result.successful}, Gagal: ${result.failed}`;
      addAutoAttackLogEntry({ target: autoAttackTargetUrl, method: autoAttackMethod, totalSent: result.totalSent, successful: result.successful, failed: result.failed, error: result.error, statusText: statusText });
      setAutoAttackStatus(result.error ? `Selesai dengan error. Menunggu.` : `Selesai. Menunggu.`);
    } catch (e: any) {
      const errorMsg = e.message || "Kesalahan tidak diketahui saat serangan otomatis.";
      addAutoAttackLogEntry({ target: autoAttackTargetUrl, method: autoAttackMethod, error: errorMsg, statusText: `Error Kritis: ${errorMsg}` });
      setAutoAttackStatus(`Error kritis. Menunggu.`);
      toast({ variant: "destructive", title: "Kesalahan Serangan Otomatis", description: errorMsg });
    } finally {
      setIsAttacking(false);
    }
  }, [autoAttackTargetUrl, autoAttackMethod, autoAttackProxyApiUrl, addAutoAttackLogEntry, toast]);

  useEffect(() => {
    let attackIntervalId: NodeJS.Timeout | undefined;
    let countdownIntervalId: NodeJS.Timeout | undefined;
    const attackCycleDuration = 25000;

    if (isAutoAttackEnabled && validateUrl(autoAttackTargetUrl) && !isAttacking) {
      runSingleAutoAttack();
      attackIntervalId = setInterval(() => {
         if (!isAttacking && isAutoAttackEnabled && validateUrl(autoAttackTargetUrl)) {
            runSingleAutoAttack();
         }
      }, attackCycleDuration);
      let remaining = attackCycleDuration / 1000;
      setCountdown(remaining - 15);
      countdownIntervalId = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) return (attackCycleDuration / 1000) - 15;
            return prev - 1;
        });
      }, 1000);
    } else if (!isAutoAttackEnabled) {
      setAutoAttackStatus("Nonaktif.");
      setCountdown(0);
    }
    return () => {
      clearInterval(attackIntervalId);
      clearInterval(countdownIntervalId);
    };
  }, [isAutoAttackEnabled, autoAttackTargetUrl, runSingleAutoAttack, isAttacking]);

  const handleToggleAutoAttack = (checked: boolean) => {
    if (checked && (!validateUrl(autoAttackTargetUrl) || !autoAttackProxyApiUrl.trim())) {
      toast({ variant: "destructive", title: "Konfigurasi Tidak Lengkap", description: "Harap isi URL target dan URL API proksi yang valid sebelum mengaktifkan." });
      setIsAutoAttackEnabled(false);
      return;
    }
    setIsAutoAttackEnabled(checked);
    if (!checked) {
      setAutoAttackStatus("Nonaktif.");
      setCountdown(0);
    } else {
      setAutoAttackStatus("Menginisialisasi...");
    }
  };
  
  const totalManualAttacks = useMemo(() => manualAttackHistory.length, [manualAttackHistory]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <LayoutDashboard className="mr-3 h-8 w-8" />
          Dasbor Admin
        </h1>
      </div>
      <p className="text-muted-foreground">
        Selamat datang di panel kontrol Flooder L7. Pantau, kelola serangan, dan atur pengguna dari sini.
      </p>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>
              <div className="flex items-center text-lg font-semibold">
                <Users className="mr-2 h-5 w-5" />
                Manajemen Pengguna
              </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <UserPlus className="mr-2 h-5 w-5" />
                      Tambah Pengguna Baru
                    </CardTitle>
                    <CardDescription>
                      Buat akun pengguna baru untuk sistem.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AddUserForm />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                 <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5" />
                        Daftar Pengguna
                      </CardTitle>
                       <CardDescription>
                        Menampilkan semua pengguna yang terdaftar dalam sistem.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Username</TableHead>
                              <TableHead>Tanggal Dibuat</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.length > 0 ? users.map(user => (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell>{new Date(user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                  Belum ada pengguna yang terdaftar.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                    </CardContent>
                  </Card>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><RotateCw className="mr-2 h-5 w-5 text-primary" />Pengaturan Serangan Otomatis</CardTitle>
              <CardDescription>Konfigurasi serangan periodik. Fitur ini sangat bergantung pada proksi dari API untuk efektivitas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="auto-attack-target" className="flex items-center"><TargetIcon className="mr-2 h-4 w-4" />URL Target Otomatis</Label>
                <Input id="auto-attack-target" placeholder="https://target-otomatis.com" value={autoAttackTargetUrl} onChange={(e) => setAutoAttackTargetUrl(e.target.value)} disabled={isAutoAttackEnabled && isAttacking} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auto-attack-proxy-api" className="flex items-center"><Globe className="mr-2 h-4 w-4" />URL API Proksi Otomatis (Wajib)</Label>
                <Input id="auto-attack-proxy-api" placeholder="https://api.proxyscrape.com/v2/?request=getproxies&protocol=http" value={autoAttackProxyApiUrl} onChange={(e) => setAutoAttackProxyApiUrl(e.target.value)} disabled={isAutoAttackEnabled && isAttacking} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auto-attack-method" className="flex items-center"><ServerIcon className="mr-2 h-4 w-4" />Metode HTTP Otomatis</Label>
                <Select value={autoAttackMethod} onValueChange={(value) => setAutoAttackMethod(value as typeof HTTP_METHODS_BASE[number])} disabled={isAutoAttackEnabled && isAttacking}>
                  <SelectTrigger id="auto-attack-method"><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectLabel>Metode</SelectLabel>{HTTP_METHODS_BASE.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectGroup></SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-3">
                <Switch id="enable-auto-attack" checked={isAutoAttackEnabled} onCheckedChange={handleToggleAutoAttack} disabled={isAttacking && isAutoAttackEnabled} />
                <Label htmlFor="enable-auto-attack" className="flex items-center">
                  <Power className={`mr-2 h-4 w-4 ${isAutoAttackEnabled ? 'text-green-500' : 'text-red-500'}`} />
                  {isAutoAttackEnabled ? 'Serangan Otomatis Aktif' : 'Serangan Otomatis Nonaktif'}
                </Label>
              </div>
              <div>
                <h4 className="font-medium flex items-center"><Zap className="mr-2 h-4 w-4 text-primary"/>Status Saat Ini:</h4>
                <p className={`text-sm ${isAttacking ? 'text-yellow-500 animate-pulse' : (isAutoAttackEnabled ? 'text-green-500' : 'text-muted-foreground')}`}>
                  {autoAttackStatus}
                  {isAutoAttackEnabled && !isAttacking && countdown > 0 && ` Serangan berikutnya dalam ~${countdown}d.`}
                </p>
              </div>
              {autoAttackLogs.length > 0 && (
                <div>
                  <h4 className="font-medium flex items-center mb-2"><FileClock className="mr-2 h-4 w-4" />Log Serangan Otomatis (5 Terbaru):</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-muted/50 rounded-md">
                    {autoAttackLogs.map((log, index) => (
                      <div key={index} className="text-xs border-b border-border pb-1 mb-1">
                        <p><span className="font-semibold">[{log.timestamp}]</span> Target: {log.target} ({log.method})</p>
                        <p className={log.error ? 'text-red-500' : 'text-green-500'}>{log.statusText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" />Riwayat Serangan Manual Terbaru</CardTitle>
              <CardDescription>Menampilkan 5 serangan manual terakhir dari halaman utama (disimpan di peramban).</CardDescription>
            </CardHeader>
            <CardContent>
              {manualAttackHistory.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Target</TableHead><TableHead>Metode</TableHead><TableHead className="text-right">Terkirim</TableHead><TableHead className="text-right">Sukses</TableHead><TableHead className="text-right">Gagal</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {manualAttackHistory.slice(0, 5).map((attack) => (
                      <TableRow key={attack.id}>
                        <TableCell className="font-medium">{new Date(attack.id).toLocaleTimeString('id-ID')}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{attack.targetUrl}</TableCell>
                        <TableCell>{attack.method}</TableCell>
                        <TableCell className="text-right">{attack.requestsSent.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-500">{attack.successful.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-500">{attack.failed.toLocaleString()}</TableCell>
                        <TableCell className="text-center"><div className="flex items-center justify-center space-x-1">{getStatusIcon(attack.status, attack.error)}<span>{attack.status}</span></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">Belum ada riwayat serangan manual.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center text-base"><Briefcase className="mr-2 h-5 w-5"/> Ringkasan Status</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center"><BarChartHorizontal className="mr-2 h-4 w-4"/>Total Serangan Manual</span><span className="font-bold text-lg">{totalManualAttacks.toLocaleString()}</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center"><Users className="mr-2 h-4 w-4"/>Proksi Otomatis Terakhir</span>{activeProxyCount === null ? <span className="font-bold text-lg animate-pulse">-</span> : <span className="font-bold text-lg">{activeProxyCount.toLocaleString()}</span>}</div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center"><Wifi className="mr-2 h-4 w-4"/>Alamat IP Anda</span>{isFetchingIp ? <span className="font-semibold animate-pulse">Memuat...</span> : userIp ? <span className="font-semibold">{userIp}</span> : <span className="font-semibold text-destructive">N/A</span>}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center text-base"><Zap className="mr-2 h-5 w-5"/>Statistik Serangan Manual</CardTitle><CardDescription>Visualisasi 5 serangan manual terakhir.</CardDescription></CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart accessibilityLayer data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 5)}/>
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} width={30}/>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Bar dataKey="successful" fill="var(--color-successful)" radius={4} name="Sukses" />
                    <Bar dataKey="failed" fill="var(--color-failed)" radius={4} name="Gagal" />
                  </BarChart>
                </ChartContainer>
              ) : (
                 <div className="flex flex-col items-center justify-center h-[200px] text-center"><Info className="h-8 w-8 text-muted-foreground mb-2"/><p className="text-muted-foreground">Belum ada data serangan.</p><p className="text-xs text-muted-foreground">Lakukan serangan untuk melihat statistik.</p></div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center text-base"><ShieldAlert className="mr-2 h-5 w-5" />Peringatan Keamanan</CardTitle></CardHeader>
            <CardContent>
              {securityAlerts.length > 0 ? (
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-2">
                  {securityAlerts.map((alert, index) => (<li key={index}><span className="text-foreground">{alert}</span></li>))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Tidak ada peringatan terdeteksi dari riwayat.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center text-base"><Settings className="mr-2 h-5 w-5" />Pengaturan Sistem</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Mode Pemeliharaan</span><span className="font-semibold text-green-500">Nonaktif</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Maks. Konkurensi</span><span className="font-semibold">20.000</span></div>
              <div className="flex justify-between items-center"><span className="text-muted-foreground">Maks. Durasi</span><span className="font-semibold">60d</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
