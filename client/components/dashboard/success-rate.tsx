"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";
import { TrendingUp } from "lucide-react";

interface SuccessRateProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

export function SuccessRate({ analytics, loading }: SuccessRateProps) {
  const total = analytics?.totalPayments ?? 0;
  const completed = analytics?.completedPayments ?? 0;
  const pending = analytics?.pendingPayments ?? 0;
  const settled = total - pending;
  const rate = settled > 0 ? (completed / settled) * 100 : 0;
  const totalVolume = parseFloat(analytics?.totalVolumeETH || "0");
  const totalGas = parseFloat(analytics?.totalGasCostETH || "0");
  const avgGas = completed > 0 ? totalGas / completed : 0;

  const data = [{ name: "rate", value: rate, fill: rate >= 80 ? "#22c55e" : rate >= 50 ? "#eab308" : "#ef4444" }];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center gap-4 px-4 pb-4">
        {loading ? (
          <Skeleton className="h-24 w-24 rounded-full" />
        ) : (
          <div className="relative shrink-0">
            <ResponsiveContainer width={110} height={110}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={data} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--muted))" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{rate.toFixed(0)}%</span>
              <span className="text-[9px] text-muted-foreground">success</span>
            </div>
          </div>
        )}
        <div className="flex-1 space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Payments</span>
            <span className="font-medium">{total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Volume</span>
            <span className="font-medium">{totalVolume.toFixed(4)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gas Spent</span>
            <span className="font-medium">{totalGas.toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Avg Gas/TX</span>
            <span className="font-medium">{avgGas.toFixed(6)} ETH</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
