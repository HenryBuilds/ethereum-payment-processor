"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsSummary } from "@/lib/api";
import { Coins } from "lucide-react";

interface CurrencyBreakdownProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}

export function CurrencyBreakdown({ analytics, loading }: CurrencyBreakdownProps) {
  const currencies = analytics?.byCurrency ? Object.entries(analytics.byCurrency) : [];
  const totalCount = currencies.reduce((sum, [, v]) => sum + v.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Currency Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : currencies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
        ) : (
          <div className="space-y-4">
            {currencies.map(([currency, data]) => {
              const pct = totalCount > 0 ? (data.count / totalCount) * 100 : 0;
              return (
                <div key={currency} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{currency}</span>
                    <span className="text-muted-foreground">
                      {data.count} payment{data.count !== 1 ? "s" : ""} &middot; {parseFloat(data.volume).toFixed(4)} {currency}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
