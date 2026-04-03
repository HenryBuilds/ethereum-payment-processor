"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SafePayment } from "@/lib/api";

type TimeRange = "1d" | "7d" | "30d" | "1y" | "all";

interface VolumeTimelineProps {
  payments: SafePayment[];
  loading: boolean;
}

function getDateRange(range: TimeRange): { start: Date; bucketCount: number; format: (d: Date) => string } {
  const now = new Date();
  switch (range) {
    case "1d": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, bucketCount: 24, format: (d) => `${d.getHours()}:00` };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, bucketCount: 7, format: (d) => d.toLocaleDateString("en-US", { weekday: "short" }) };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, bucketCount: 30, format: (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    }
    case "1y": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, bucketCount: 12, format: (d) => d.toLocaleDateString("en-US", { month: "short" }) };
    }
    case "all":
    default: {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 2);
      start.setHours(0, 0, 0, 0);
      return { start, bucketCount: 12, format: (d) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
    }
  }
}

function bucketKey(d: Date, range: TimeRange): string {
  switch (range) {
    case "1d": return `${d.getHours()}`;
    case "7d":
    case "30d": return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    case "1y":
    case "all": return `${d.getFullYear()}-${d.getMonth()}`;
  }
}

function buildChartData(payments: SafePayment[], range: TimeRange) {
  const { start, bucketCount, format } = getDateRange(range);
  const now = new Date();

  // Build empty buckets
  const buckets = new Map<string, { label: string; volume: number; count: number }>();

  if (range === "1d") {
    for (let h = 0; h < 24; h++) {
      const d = new Date(start);
      d.setHours(h);
      buckets.set(`${h}`, { label: format(d), volume: 0, count: 0 });
    }
  } else if (range === "7d" || range === "30d") {
    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      buckets.set(key, { label: format(d), volume: 0, count: 0 });
    }
  } else {
    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.set(key, { label: format(d), volume: 0, count: 0 });
    }
  }

  // Fill data
  for (const p of payments) {
    const created = new Date(p.createdAt);
    if (created < start || created > now) continue;
    const key = bucketKey(created, range);
    const bucket = buckets.get(key);
    if (bucket) {
      // Normalize to ETH-equivalent for display
      const amt = parseFloat(p.amount) || 0;
      bucket.volume += p.currency === "ETH" ? amt : 0;
      bucket.count += 1;
    }
  }

  return Array.from(buckets.values()).map((b) => ({
    ...b,
    volume: Math.round(b.volume * 10000) / 10000,
  }));
}

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export function VolumeTimeline({ payments, loading }: VolumeTimelineProps) {
  const [range, setRange] = useState<TimeRange>("30d");

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Payment Volume</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Skeleton className="h-full w-full min-h-[160px]" />
        </CardContent>
      </Card>
    );
  }

  const data = buildChartData(payments, range);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Payment Volume (ETH)</CardTitle>
        <div className="flex gap-0.5 rounded-md border p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                range === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={140}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#627eea" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#627eea" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#e5e5e5", fontWeight: 500 }}
              axisLine={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              tickLine={{ stroke: "rgba(255,255,255,0.15)", size: 4 }}
              tickMargin={6}
              interval={range === "30d" ? 4 : range === "1d" ? 3 : "preserveStartEnd"}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#e5e5e5", fontWeight: 500 }}
              axisLine={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              tickLine={{ stroke: "rgba(255,255,255,0.15)", size: 4 }}
              tickMargin={4}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--popover-foreground))",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value} ETH`, "Volume"]}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#627eea"
              strokeWidth={2}
              fill="url(#volumeGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
