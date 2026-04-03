"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";

interface StatusChartProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  pending: "#eab308",
  failed: "#ef4444",
  expired: "#6b7280",
  partial: "#f97316",
  cancelled: "#8b5cf6",
  refunded: "#06b6d4",
};

export function StatusChart({ analytics, loading }: StatusChartProps) {
  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 px-4 pb-4">
          <Skeleton className="h-28 w-28 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const data = Object.entries(analytics?.byStatus || {})
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: STATUS_COLORS[status] || "#6b7280",
    }));

  if (data.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 text-muted-foreground text-xs px-4 pb-4">
          No data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0 pt-4 px-4">
        <CardTitle className="text-sm font-medium">Status</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius="40%"
              outerRadius="65%"
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--popover-foreground))",
                fontSize: "12px",
              }}
              formatter={(value, name) => [`${value}`, name]}
            />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
