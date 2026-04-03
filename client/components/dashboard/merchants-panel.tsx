"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Merchant } from "@/lib/api";
import { registerMerchant } from "@/lib/api";
import { Plus, Copy, Store } from "lucide-react";

interface MerchantsPanelProps {
  merchants: Merchant[];
  loading: boolean;
  onCreated: () => void;
}

export function MerchantsPanel({ merchants, loading, onCreated }: MerchantsPanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [newMerchant, setNewMerchant] = useState<Merchant | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await registerMerchant({ name, email: email || undefined });
      setNewMerchant(res.data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register merchant");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setName("");
      setEmail("");
      setNewMerchant(null);
      setError("");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Merchants
        </CardTitle>
        <Dialog open={open} onOpenChange={handleClose}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{newMerchant ? "Merchant Registered" : "Register Merchant"}</DialogTitle>
            </DialogHeader>
            {newMerchant ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{newMerchant.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">API Key</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm break-all">{newMerchant.apiKey}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigator.clipboard.writeText(newMerchant.apiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save this API key - it won&apos;t be shown again in full.
                </p>
                <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Shop" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email (optional)</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="shop@example.com" />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Registering..." : "Register"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No merchants registered</p>
        ) : (
          <div className="space-y-3">
            {merchants.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{m.name}</p>
                  {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {m.apiKey.slice(0, 12)}...
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
