
"use client";

import type { FloodStats } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertCircle, CheckCircle, XCircle, BarChartBig, TimerIcon, ListTree, WifiOff, ServerCrash, AlertTriangle, ShieldAlert, Network, ShieldQuestion, ArrowRightLeft, TimerOff } from "lucide-react";
import { useEffect, useState } from "react";

interface ProgressDisplayProps {
  isLoading: boolean;
  stats: FloodStats | null;
  error: string | null; // This is for errors caught by the form's transition handler
  attackDuration?: number | null;
}

const renderStatusCodeLabel = (code: number): string => {
  if (code === 0) return "Waktu Habis/Batal";
  if (code === -1) return "Kesalahan Jaringan/Proxy";
  return `HTTP ${code}`;
};

const renderStatusCodeIcon = (code: number): React.ReactElement => {
  const iconClass = "mr-2 h-4 w-4 shrink-0";
  if (code >= 200 && code < 300) return <CheckCircle className={`${iconClass} text-green-500`} />;
  if (code >= 300 && code < 400) return <ArrowRightLeft className={`${iconClass} text-blue-500`} />;
  if (code >= 400 && code < 500) return <ShieldAlert className={`${iconClass} text-yellow-500`} />;
  if (code >= 500 && code < 600) return <ServerCrash className={`${iconClass} text-red-500`} />;
  if (code === 0) return <TimerOff className={`${iconClass} text-muted-foreground`} />;
  if (code === -1) return <WifiOff className={`${iconClass} text-red-600`} />;
  return <ShieldQuestion className={`${iconClass} text-muted-foreground`} />;
};


interface TargetStatus {
  text: string;
  icon: React.ElementType;
  colorClass: string;
  shortStatus: string;
}

function getTargetNetworkStatusSummary(stats: FloodStats | null): TargetStatus | null {
  if (!stats || stats.totalSent === 0) {
    return { text: "Status target tidak jelas (tidak ada permintaan terkirim atau data hilang).", icon: ShieldQuestion, colorClass: "text-muted-foreground", shortStatus: "Tidak Diketahui" };
  }

  const { totalSent, successful, statusCodeCounts = {} } = stats;
  const successfulRate = totalSent > 0 ? successful / totalSent : 0;
  const timeoutCount = statusCodeCounts[0] || 0;
  const networkErrorCount = statusCodeCounts[-1] || 0;

  let serverErrorCount = 0;
  Object.entries(statusCodeCounts).forEach(([code, count]) => {
    const numericCode = parseInt(code);
    if (numericCode >= 500 && numericCode <= 599) {
      serverErrorCount += count;
    }
  });

  const criticalFailureRate = totalSent > 0 ? (timeoutCount + networkErrorCount) / totalSent : 0;
  const serverErrorRate = totalSent > 0 ? serverErrorCount / totalSent : 0;

  if (criticalFailureRate > 0.7) {
    return { text: "Target: Sebagian besar tidak responsif atau ada masalah signifikan pada jaringan/proksi.", icon: WifiOff, colorClass: "text-red-500", shortStatus: "Tidak Responsif" };
  }
  if (serverErrorRate > 0.5) {
    return { text: "Target: Mengalami tingkat kesalahan sisi server yang tinggi (5xx).", icon: ServerCrash, colorClass: "text-yellow-500", shortStatus: "Error Server" };
  }
  if (successfulRate > 0.7) {
    return { text: "Target: Tampak responsif terhadap sebagian besar permintaan.", icon: CheckCircle, colorClass: "text-green-500", shortStatus: "Responsif" };
  }
  if (successfulRate > 0.4) {
    return { text: "Target: Responsif sebagian, namun beberapa kesalahan terdeteksi.", icon: AlertTriangle, colorClass: "text-yellow-600", shortStatus: "Sebagian Responsif" };
  }
  if (totalSent > 0) {
     return { text: "Target: Mengalami kesalahan signifikan atau tingkat responsivitas rendah.", icon: ShieldAlert, colorClass: "text-orange-500", shortStatus: "Responsivitas Rendah" };
  }
  return { text: "Status target tidak dapat ditentukan dari data yang ada.", icon: ShieldQuestion, colorClass: "text-muted-foreground", shortStatus: "Tidak Dapat Ditentukan" };
}


export function ProgressDisplay({ isLoading, stats, error, attackDuration }: ProgressDisplayProps) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (isLoading && attackDuration && attackDuration > 0) {
      setRemainingTime(attackDuration);
      intervalId = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime === null || prevTime <= 1) {
            clearInterval(intervalId!);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      setRemainingTime(null);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isLoading, attackDuration]);


  if (!isLoading && !stats && !error) {
    return null;
  }

  const targetStatusSummary = !isLoading && stats && !stats.error ? getTargetNetworkStatusSummary(stats) : null;

  return (
    <Card className="mt-6 bg-card/50 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <BarChartBig className="mr-2 h-6 w-6 text-primary" />
          Status Serangan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center space-y-3 text-lg text-primary">
            <div className="flex items-center">
              <Loader2 className="mr-3 h-7 w-7 animate-spin" />
              <span className="font-semibold">Serangan sedang berlangsung... Mohon tunggu.</span>
            </div>
            {remainingTime !== null && remainingTime > 0 && (
              <div className="flex items-center text-base text-muted-foreground">
                <TimerIcon className="mr-2 h-5 w-5" />
                <span>Estimasi waktu tersisa: {remainingTime}d</span>
              </div>
            )}
            {remainingTime === 0 && (
                 <p className="text-base text-muted-foreground animate-pulse">
                    Menyelesaikan hasil...
                </p>
            )}
          </div>
        )}

        {/* This 'error' is from the form's useTransition catch block (e.g., if startFloodAttack itself throws an unrecoverable error) */}
        {!isLoading && error && (
          <div className="flex items-center text-destructive text-lg p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="mr-3 h-6 w-6" />
            <span className="font-medium">Kesalahan Kritis Operasi: {error}</span>
          </div>
        )}

        {/* This 'stats.error' is from the FloodStats object, meaning the flood action ran but reported an error in its own execution */}
         {!isLoading && stats && stats.error && !error && (
          <div className="flex items-center text-destructive text-lg p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="mr-3 h-6 w-6" />
            <span className="font-medium">Kesalahan Selama Serangan: {stats.error}</span>
          </div>
        )}

        {!isLoading && stats && !stats.error && (
          <div className="space-y-3 text-foreground">
            <div className="text-center mb-3">
              <p className="text-xl font-semibold text-primary flex items-center justify-center">
                <CheckCircle className="mr-2 h-7 w-7 text-green-500" />
                Serangan Selesai!
              </p>
            </div>

            {targetStatusSummary && (
              <>
                <Separator />
                <h4 className="text-md font-semibold flex items-center text-muted-foreground pt-3">
                  <Network className="mr-2 h-5 w-5" />
                  Catatan Hasil Status Jaringan Target:
                </h4>
                <div className="overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Ikon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deskripsi Detil</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <targetStatusSummary.icon className={`h-6 w-6 ${targetStatusSummary.colorClass}`} />
                        </TableCell>
                        <TableCell className={`font-medium ${targetStatusSummary.colorClass}`}>
                          {targetStatusSummary.shortStatus}
                        </TableCell>
                        <TableCell className="text-sm">{targetStatusSummary.text}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            
            <Separator className="pt-3" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                <p className="text-sm text-muted-foreground">Total Terkirim</p>
                <p className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                 <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-sm text-muted-foreground">Berhasil (2xx-3xx)</p>
                <p className="text-2xl font-bold">{stats.successful.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                <XCircle className="h-5 w-5 text-red-500 mb-1" />
                <p className="text-sm text-muted-foreground">Gagal/Lainnya</p>
                <p className="text-2xl font-bold">{stats.failed.toLocaleString()}</p>
              </div>
            </div>
            {stats.statusCodeCounts && Object.keys(stats.statusCodeCounts).length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2">
                  <h4 className="text-md font-semibold flex items-center text-muted-foreground">
                    <ListTree className="mr-2 h-5 w-5" />
                    Rincian Kode Respons:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm max-h-48 overflow-y-auto p-1">
                    {Object.entries(stats.statusCodeCounts)
                      .sort(([aCode], [bCode]) => parseInt(aCode) - parseInt(bCode))
                      .map(([code, count]) => {
                        const numericCode = parseInt(code);
                        return (
                          <div key={code} className="p-2 bg-muted/70 rounded-md flex justify-between items-center shadow-sm">
                            <span className="font-medium text-foreground flex items-center">
                              {renderStatusCodeIcon(numericCode)}
                              {renderStatusCodeLabel(numericCode)}
                            </span>
                            <span className="font-bold text-primary">{count.toLocaleString()}</span>
                          </div>
                        );
                      })}
                  </div>
                   <p className="text-xs text-muted-foreground pt-1">
                    Catatan: "Waktu Habis/Batal" dan "Kesalahan Jaringan/Proxy" menunjukkan masalah dalam mencapai target atau respons tidak diterima tepat waktu. Kode 5xx adalah kesalahan server dari target.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
