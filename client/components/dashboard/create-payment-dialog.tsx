"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPayment } from "@/lib/api";
import { Plus, Copy, CheckCircle } from "lucide-react";

interface CreatePaymentDialogProps {
  onCreated: () => void;
}

export function CreatePaymentDialog({ onCreated }: CreatePaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ETH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    paymentId: string;
    address: string;
    amount: string;
    currency: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await createPayment({ orderId, amount, currency });
      setResult(res.data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setOrderId("");
      setAmount("");
      setCurrency("ETH");
      setResult(null);
      setError("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        New Payment
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result ? "Payment Created" : "Create Payment"}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Payment ID</p>
                <p className="font-mono text-sm">{result.paymentId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Send {result.amount} {result.currency} to</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm break-all">{result.address}</p>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(result.address)}>
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expires</p>
                <p className="text-sm">{new Date(result.expiresAt).toLocaleString()}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Order ID</label>
              <Input
                placeholder="ORD-001"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.05"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="DAI">DAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Payment"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
