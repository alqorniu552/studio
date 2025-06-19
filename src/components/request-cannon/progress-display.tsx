
"use client";

import type { FloodStats } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, CheckCircle, XCircle, BarChartBig, TimerIcon, ListTree } from "lucide-react";
import { useEffect, useState } from "react";

interface ProgressDisplayProps {
  isLoading: boolean;
  stats: FloodStats | null;
  error: string | null;
  attackDuration?: number | null; 
}

const renderStatusCodeLabel = (code: number): string => {
  if (code === 0) return "Timeout/Abort";
  if (code === -1) return "Network/Proxy Err";
  return `HTTP ${code}`;
};

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

  return (
    <Card className="mt-6 bg-card/50 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <BarChartBig className="mr-2 h-6 w-6 text-primary" />
          Attack Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center space-y-3 text-lg text-primary">
            <div className="flex items-center">
              <Loader2 className="mr-3 h-7 w-7 animate-spin" />
              <span className="font-semibold">Attack in progress... Please wait.</span>
            </div>
            {remainingTime !== null && remainingTime > 0 && (
              <div className="flex items-center text-base text-muted-foreground">
                <TimerIcon className="mr-2 h-5 w-5" />
                <span>Estimated time remaining: {remainingTime}s</span>
              </div>
            )}
            {remainingTime === 0 && (
                 <p className="text-base text-muted-foreground animate-pulse">
                    Finalizing results...
                </p>
            )}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-center text-destructive text-lg p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="mr-3 h-6 w-6" />
            <span className="font-medium">Error: {error}</span>
          </div>
        )}

        {!isLoading && stats && !stats.error && (
          <div className="space-y-3 text-foreground">
            <p className="text-xl font-semibold text-primary flex items-center justify-center">
              <CheckCircle className="mr-2 h-7 w-7 text-green-500" />
              Attack Completed!
            </p>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                 <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-sm text-muted-foreground">Successful (2xx-3xx)</p>
                <p className="text-2xl font-bold">{stats.successful.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow-inner">
                <XCircle className="h-5 w-5 text-red-500 mb-1" />
                <p className="text-sm text-muted-foreground">Failed/Other</p>
                <p className="text-2xl font-bold">{stats.failed.toLocaleString()}</p>
              </div>
            </div>
            {stats.statusCodeCounts && Object.keys(stats.statusCodeCounts).length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2">
                  <h4 className="text-md font-semibold flex items-center text-muted-foreground">
                    <ListTree className="mr-2 h-5 w-5" />
                    Response Code Breakdown:
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm max-h-48 overflow-y-auto">
                    {Object.entries(stats.statusCodeCounts)
                      .sort(([aCode], [bCode]) => parseInt(aCode) - parseInt(bCode)) 
                      .map(([code, count]) => (
                        <div key={code} className="p-2 bg-muted/70 rounded-md flex justify-between items-center shadow-sm">
                          <span className="font-medium text-foreground">
                            {renderStatusCodeLabel(parseInt(code))}
                          </span>
                          <span className="font-bold text-primary">{count.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
         {!isLoading && stats && stats.error && !error && ( 
          <div className="flex items-center text-destructive text-lg p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="mr-3 h-6 w-6" />
            <span className="font-medium">Error: {stats.error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
