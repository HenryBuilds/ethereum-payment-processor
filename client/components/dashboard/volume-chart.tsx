"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";

interface VolumeChartProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

const CURRENCY_COLORS: Record<string, string> = {
  ETH: "#627eea",
  USDT: "#26a17b",
  USDC: "#2775ca",
  DAI: "#f5ac37",
};

export function VolumeChart({ analytics, loading }: VolumeChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Volume by Currency</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = Object.entries(analytics?.byCurrency || {}).map(([currency, info]) => ({
    currency,
    volume: parseFloat(info.volume),
    count: info.count,
    fill: CURRENCY_COLORS[currency] || "#6b7280",
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Volume by Currency</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
          No volume data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Volume by Currency</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              type="category"
              dataKey="currency"
              width={50}
              tick={{ fontSize: 13, fill: "hsl(var(--foreground))", fontWeight: 500 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--popover-foreground))",
                fontSize: "13px",
              }}
              formatter={(value, _name, entry) => [
                `${Number(value).toFixed(4)} ${(entry as any).payload.currency} (${(entry as any).payload.count} payments)`,
                "Volume",
              ]}
            />
            <Bar dataKey="volume" radius={[0, 6, 6, 0]} barSize={28}>
              {data.map((entry, index) => (
                <Bar key={index} dataKey="volume" fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
