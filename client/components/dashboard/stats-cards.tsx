"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface StatsCardsProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

export function StatsCards({ analytics, loading }: StatsCardsProps) {
  const stats = [
    { label: "Pending", value: analytics?.pendingPayments ?? 0, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "Completed", value: analytics?.completedPayments ?? 0, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Failed", value: (analytics?.failedPayments ?? 0) + (analytics?.expiredPayments ?? 0), icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 flex-1">
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-6" />
              </CardContent>
            </Card>
          ))
        : stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 flex flex-col items-center gap-1">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${s.bg}`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold leading-none">{s.value}</p>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}
