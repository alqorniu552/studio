
"use client";

import type { FloodStats } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, CheckCircle, XCircle, BarChartBig } from "lucide-react";

interface ProgressDisplayProps {
  isLoading: boolean;
  stats: FloodStats | null;
  error: string | null;
}

export function ProgressDisplay({ isLoading, stats, error }: ProgressDisplayProps) {
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
          <div className="flex items-center text-lg text-primary">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span>Attack in progress... Please wait.</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex items-center text-destructive text-lg">
            <AlertCircle className="mr-2 h-6 w-6" />
            <span>Error: {error}</span>
          </div>
        )}

        {!isLoading && stats && !stats.error && (
          <div className="space-y-2 text-foreground">
            <p className="text-lg font-semibold text-primary">Attack Completed!</p>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{stats.totalSent}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow">
                 <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold">{stats.successful}</p>
              </div>
              <div className="flex flex-col items-center p-3 bg-muted rounded-md shadow">
                <XCircle className="h-5 w-5 text-red-500 mb-1" />
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
