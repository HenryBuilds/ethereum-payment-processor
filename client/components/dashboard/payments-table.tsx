"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SafePayment } from "@/lib/api";
import { Copy, ExternalLink } from "lucide-react";

interface PaymentsTableProps {
  payments: SafePayment[];
  loading: boolean;
  pagination: { total: number; page: number; pages: number } | null;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onPageChange: (page: number) => void;
  onCancelPayment: (id: string) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  expired: "secondary",
  partial: "secondary",
  cancelled: "secondary",
  refunded: "secondary",
};

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function PaymentsTable({
  payments,
  loading,
  pagination,
  statusFilter,
  onStatusFilter,
  onPageChange,
  onCancelPayment,
}: PaymentsTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => v && onStatusFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} payment{pagination.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-sm">{payment.orderId}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => copyToClipboard(payment.address)}
                      className="flex items-center gap-1 font-mono text-sm hover:text-primary transition-colors"
                    >
                      {truncateAddress(payment.address)}
                      <Copy className="h-3 w-3" />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.amount} {payment.currency}
                    {payment.receivedAmount && payment.status === "partial" && (
                      <span className="block text-xs text-muted-foreground">
                        received: {payment.receivedAmount}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[payment.status] || "outline"}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(payment.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {payment.txHash && (
                        <a
                          href={`https://etherscan.io/tx/${payment.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {payment.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8"
                          onClick={() => onCancelPayment(payment.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
