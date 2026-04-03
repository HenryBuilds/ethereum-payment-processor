"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SafePayment } from "@/lib/api";
import { ArrowUpRight, ArrowDownRight, Clock, XCircle, AlertTriangle, Undo2 } from "lucide-react";

interface RecentActivityProps {
  payments: SafePayment[];
  loading: boolean;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Payment created" },
  completed: { icon: ArrowUpRight, color: "text-green-500", label: "Payment completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Payment failed" },
  expired: { icon: Clock, color: "text-gray-500", label: "Payment expired" },
  partial: { icon: AlertTriangle, color: "text-orange-500", label: "Partial payment" },
  cancelled: { icon: XCircle, color: "text-purple-500", label: "Payment cancelled" },
  refunded: { icon: Undo2, color: "text-cyan-500", label: "Payment refunded" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivity({ payments, loading }: RecentActivityProps) {
  const recent = payments.slice(0, 6);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 shrink-0">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {recent.map((payment) => {
              const config = statusConfig[payment.status] || statusConfig.pending;
              const Icon = config.icon;
              return (
                <div key={payment.id} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.orderId} &middot; {payment.amount} {payment.currency}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(payment.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
