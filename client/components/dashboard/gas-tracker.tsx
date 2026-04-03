"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";
import { Fuel } from "lucide-react";

interface GasTrackerProps {
  analytics: AnalyticsSummary | null;
  ethPrice: number | null;
  loading: boolean;
}

export function GasTracker({ analytics, ethPrice, loading }: GasTrackerProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Gas Fees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalGas = parseFloat(analytics?.totalGasCostETH || "0");
  const totalVolume = parseFloat(analytics?.totalVolumeETH || "0");
  const gasPercent = totalVolume > 0 ? ((totalGas / totalVolume) * 100).toFixed(2) : "0";
  const completed = analytics?.completedPayments ?? 0;
  const avgGas = completed > 0 ? (totalGas / completed) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Fuel className="h-4 w-4" />
          Gas Fees
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Gas Spent</p>
            <p className="text-sm font-bold">{totalGas.toFixed(6)} ETH</p>
            {ethPrice && (
              <p className="text-xs text-muted-foreground">
                ~${(totalGas * ethPrice).toFixed(2)} USD
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg. Gas per TX</p>
            <p className="text-sm font-bold">{avgGas.toFixed(6)} ETH</p>
            {ethPrice && (
              <p className="text-xs text-muted-foreground">
                ~${(avgGas * ethPrice).toFixed(2)} USD
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gas / Volume ratio</span>
            <span className="font-medium">{gasPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(parseFloat(gasPercent), 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
