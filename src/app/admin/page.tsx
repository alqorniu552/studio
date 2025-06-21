
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart2, Users, Settings, ShieldAlert, LayoutDashboard, History, CheckCircle, XCircle, AlertTriangle, Power, FileClock, Zap, Target as TargetIcon, Server as ServerIcon, RotateCw, Wifi, Globe } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { startFloodAttack, type FloodStats, getUserIpAddress } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

// Define the interface for attack history entries, can be moved to a shared types file later
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

const getStatusIcon = (status: string, error?: string): React.ReactElement => {
    if (error || status.toLowerCase() === "gagal") return <XCircle className="h-4 w-4 text-red-500" />;
    if (status.toLowerCase() === "selesai") return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />; // Default for other statuses like "Berjalan" or unknown
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
  const [totalManualAttacks, setTotalManualAttacks] = useState(0);
  const [userIp, setUserIp] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);
  const [isFetchingIp, setIsFetchingIp] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState<string[]>([]);
  const [activeProxyCount, setActiveProxyCount] = useState<number | null>(null);

  useEffect(() => {
    // Load manual attack history from localStorage
    const storedHistory = localStorage.getItem(ATTACK_HISTORY_STORAGE_KEY);
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setManualAttackHistory(parsedHistory);
          setTotalManualAttacks(parsedHistory.length);
        }
      } catch (e) {
        console.error("Failed to parse attack history from localStorage:", e);
      }
    }

    // Fetch user IP
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

  }, []);

  // Analyze history for security alerts
  useEffect(() => {
    const analyzeHistoryForAlerts = (history: AttackHistoryEntry[], logs: AutoAttackLogEntry[]): string[] => {
      const alerts: Set<string> = new Set();
      const alertThreshold = 0.5; // 50%

      const getHostname = (url: string) => {
        try {
          return new URL(url).hostname;
        } catch (e) {
          return url; // Fallback to full URL if parsing fails
        }
      };

      // Analyze manual history
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

          if ((wafCount / attack.requestsSent) > alertThreshold) {
            alerts.add(`Potensi WAF/Rate Limit pada ${getHostname(attack.targetUrl)}`);
          }
          if ((serverErrorCount / attack.requestsSent) > alertThreshold) {
            alerts.add(`Potensi ketidakstabilan server pada ${getHostname(attack.targetUrl)}`);
          }
        } else if (attack.error) {
            alerts.add(`Serangan ke ${getHostname(attack.targetUrl)} gagal`);
        }
      });

      // Analyze auto-attack logs
      logs.forEach(log => {
        if (log.error) {
          alerts.add(`Serangan otomatis ke ${getHostname(log.target)} gagal`);
        }
      });

      return Array.from(alerts).slice(0, 3); // Limit to 3 for display
    };

    const newAlerts = analyzeHistoryForAlerts(manualAttackHistory, autoAttackLogs);
    setSecurityAlerts(newAlerts);
  }, [manualAttackHistory, autoAttackLogs]);


  const addAutoAttackLogEntry = useCallback((logEntry: Omit<AutoAttackLogEntry, 'timestamp'>) => {
    const newEntry = { ...logEntry, timestamp: new Date().toLocaleString('id-ID') };
    setAutoAttackLogs(prev => [newEntry, ...prev.slice(0, 4)]); // Keep last 5 logs
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
      setIsAutoAttackEnabled(false); // Disable if URL becomes invalid
      return;
    }

    if (!autoAttackProxyApiUrl.trim()) {
        toast({ variant: "destructive", title: "URL API Proksi Diperlukan", description: "Serangan otomatis memerlukan URL API proksi untuk berfungsi dengan andal. Harap isi kolom URL API Proksi Otomatis." });
        setIsAutoAttackEnabled(false);
        return;
    }

    setIsAttacking(true);
    setAutoAttackStatus(`Menyerang ${autoAttackTargetUrl} (${autoAttackMethod})...`);
    
    try {
      const result = await startFloodAttack(
        autoAttackTargetUrl,
        autoAttackMethod,
        undefined, // headers
        undefined, // body
        50,        // concurrency (default)
        100,       // rate (higher default for auto)
        15,        // duration (15s burst)
        undefined, // proxiesString - Auto attack uses API only
        autoAttackProxyApiUrl.trim() ? autoAttackProxyApiUrl : undefined  // proxyApiUrl
      );

      if (result.proxiesUsed !== undefined) {
        setActiveProxyCount(result.proxiesUsed);
      }

      const statusText = result.error ? `Error: ${result.error}` : `Selesai. Terkirim: ${result.totalSent}, Sukses: ${result.successful}, Gagal: ${result.failed}`;
      addAutoAttackLogEntry({
        target: autoAttackTargetUrl,
        method: autoAttackMethod,
        totalSent: result.totalSent,
        successful: result.successful,
        failed: result.failed,
        error: result.error,
        statusText: statusText
      });
      setAutoAttackStatus(result.error ? `Selesai dengan error. Menunggu.` : `Selesai. Menunggu.`);
      
    } catch (e: any) {
      const errorMsg = e.message || "Kesalahan tidak diketahui saat serangan otomatis.";
      addAutoAttackLogEntry({
        target: autoAttackTargetUrl,
        method: autoAttackMethod,
        error: errorMsg,
        statusText: `Error Kritis: ${errorMsg}`
      });
      setAutoAttackStatus(`Error kritis. Menunggu.`);
      toast({ variant: "destructive", title: "Kesalahan Serangan Otomatis", description: errorMsg });
    } finally {
      setIsAttacking(false);
    }
  }, [autoAttackTargetUrl, autoAttackMethod, autoAttackProxyApiUrl, addAutoAttackLogEntry, toast]);


  useEffect(() => {
    let attackIntervalId: NodeJS.Timeout | undefined;
    let countdownIntervalId: NodeJS.Timeout | undefined;
    const attackCycleDuration = 25000; // 15s attack + 10s wait 

    if (isAutoAttackEnabled && validateUrl(autoAttackTargetUrl) && !isAttacking) {
      runSingleAutoAttack(); // Run immediately
      
      attackIntervalId = setInterval(() => {
         if (!isAttacking && isAutoAttackEnabled && validateUrl(autoAttackTargetUrl)) { // Check again before running
            runSingleAutoAttack();
         }
      }, attackCycleDuration);

      // Countdown logic
      let remaining = attackCycleDuration / 1000;
      setCountdown(remaining - 15); // Initial wait time
      countdownIntervalId = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                return (attackCycleDuration / 1000) - 15; 
            }
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
    if (checked && !validateUrl(autoAttackTargetUrl)) {
      toast({ variant: "destructive", title: "URL Target Diperlukan", description: "Harap masukkan URL target yang valid sebelum mengaktifkan serangan otomatis." });
      setIsAutoAttackEnabled(false);
      return;
    }
     if (checked && !autoAttackProxyApiUrl.trim()) {
      toast({ variant: "destructive", title: "URL API Proksi Diperlukan", description: "Serangan otomatis memerlukan URL API proksi. Harap isi sebelum mengaktifkan." });
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


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline text-primary flex items-center">
          <LayoutDashboard className="mr-3 h-8 w-8" />
          Dasbor Administrator
        </h1>
      </div>
      <p className="text-muted-foreground">
        Selamat datang di panel administrasi Flooder L7.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Serangan Manual (Lokal)</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalManualAttacks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Dari riwayat penyimpanan peramban.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proksi Aktif (Otomatis)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {activeProxyCount === null ? (
              <div className="text-2xl font-bold animate-pulse">-</div>
            ) : (
              <div className="text-2xl font-bold">{activeProxyCount.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Digunakan pada serangan otomatis terakhir.
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peringatan Keamanan</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${securityAlerts.length > 0 ? 'text-destructive' : ''}`}>
              {securityAlerts.length}
            </div>
            {securityAlerts.length > 0 ? (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 mt-1">
                {securityAlerts.map((alert, index) => (
                  <li key={index}>{alert}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tidak ada peringatan terdeteksi dari riwayat.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alamat IP Anda</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isFetchingIp ? (
              <div className="text-2xl font-bold animate-pulse">Memuat...</div>
            ) : userIp ? (
              <div className="text-2xl font-bold">{userIp}</div>
            ) : (
              <div className="text-lg font-bold text-destructive">{ipError}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Terdeteksi dari header permintaan server.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto Attack Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <RotateCw className="mr-2 h-5 w-5 text-primary" />
            Pengaturan Serangan Otomatis
          </CardTitle>
          <CardDescription>
            Konfigurasi dan aktifkan serangan otomatis periodik ke target. Serangan ini sangat bergantung pada proksi dari API untuk efektivitas dan menghindari pemblokiran.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="auto-attack-target" className="flex items-center"><TargetIcon className="mr-2 h-4 w-4" />URL Target Otomatis</Label>
            <Input 
              id="auto-attack-target" 
              placeholder="https://target-otomatis.com" 
              value={autoAttackTargetUrl}
              onChange={(e) => setAutoAttackTargetUrl(e.target.value)}
              disabled={isAutoAttackEnabled && isAttacking}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-attack-proxy-api" className="flex items-center"><Globe className="mr-2 h-4 w-4" />URL API Proksi Otomatis (Wajib)</Label>
            <Input 
              id="auto-attack-proxy-api" 
              placeholder="https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all"
              value={autoAttackProxyApiUrl}
              onChange={(e) => setAutoAttackProxyApiUrl(e.target.value)}
              disabled={isAutoAttackEnabled && isAttacking}
            />
             <CardDescription>
                Serangan otomatis sangat disarankan menggunakan proksi untuk menghindari pemblokiran IP. Masukkan URL yang mengembalikan daftar proksi.
            </CardDescription>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-attack-method" className="flex items-center"><ServerIcon className="mr-2 h-4 w-4" />Metode HTTP Otomatis</Label>
            <Select 
              value={autoAttackMethod} 
              onValueChange={(value) => setAutoAttackMethod(value as typeof HTTP_METHODS_BASE[number])}
              disabled={isAutoAttackEnabled && isAttacking}
            >
              <SelectTrigger id="auto-attack-method">
                <SelectValue placeholder="Pilih metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Metode HTTP Dasar</SelectLabel>
                  {HTTP_METHODS_BASE.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-3">
            <Switch 
              id="enable-auto-attack" 
              checked={isAutoAttackEnabled}
              onCheckedChange={handleToggleAutoAttack}
              disabled={isAttacking && isAutoAttackEnabled} 
            />
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

      {/* Manual Attack History Card - Now dynamic from localStorage */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="mr-2 h-5 w-5" />
            Riwayat Serangan Manual Terbaru
          </CardTitle>
          <CardDescription>
            Menampilkan ringkasan serangan manual yang telah dilakukan dari halaman utama (disimpan di peramban Anda).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {manualAttackHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal &amp; Waktu</TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-center">Durasi</TableHead>
                  <TableHead className="text-right">Terkirim</TableHead>
                  <TableHead className="text-right">Sukses</TableHead>
                  <TableHead className="text-right">Gagal</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualAttackHistory.slice(0, 5).map((attack) => (
                  <TableRow key={attack.id}>
                    <TableCell className="font-medium">{attack.dateTime}</TableCell>
                    <TableCell className="truncate max-w-xs">{attack.targetUrl}</TableCell>
                    <TableCell>{attack.method}</TableCell>
                    <TableCell className="text-center">{attack.duration}d</TableCell>
                    <TableCell className="text-right">{attack.requestsSent.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-500">{attack.successful.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-red-500">{attack.failed.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {getStatusIcon(attack.status, attack.error)}
                        <span>{attack.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">Belum ada riwayat serangan manual yang tercatat.</p>
          )}
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
            <p className="text-sm text-muted-foreground">20000 permintaan/detik</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    

    

    
