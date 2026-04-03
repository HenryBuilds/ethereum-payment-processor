"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface EthPriceCardProps {
  ethPrice: number | null;
  loading: boolean;
}

export function EthPriceCard({ ethPrice, loading }: EthPriceCardProps) {
  return (
    <Card className="bg-gradient-to-br from-[#627eea]/15 to-transparent border-[#627eea]/20 h-full">
      <CardContent className="p-4 flex items-center gap-3 h-full">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#627eea]/20">
          <svg viewBox="0 0 256 256" className="h-5 w-5" fill="none">
            <path d="M128 16L48 128l80 48 80-48L128 16z" fill="#627eea" opacity="0.6" />
            <path d="M128 16l80 112-80 48V16z" fill="#627eea" />
            <path d="M128 192l-80-48 80 96 80-96-80 48z" fill="#627eea" opacity="0.6" />
            <path d="M128 240l80-96-80 48V240z" fill="#627eea" />
          </svg>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ethereum</p>
          {loading ? (
            <Skeleton className="h-7 w-28 mt-0.5" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {ethPrice
                ? `$${ethPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "Loading..."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
