"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Webhook, WebhookEvent } from "@/lib/api";
import { registerWebhook, deleteWebhook } from "@/lib/api";
import { Plus, Trash2, Webhook as WebhookIcon } from "lucide-react";

const ALL_EVENTS: WebhookEvent[] = [
  "payment.completed",
  "payment.failed",
  "payment.expired",
  "payment.partial",
  "payment.cancelled",
  "payment.refunded",
];

interface WebhooksPanelProps {
  webhooks: Webhook[];
  loading: boolean;
  onChanged: () => void;
}

export function WebhooksPanel({ webhooks, loading, onChanged }: WebhooksPanelProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([...ALL_EVENTS]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      setError("Select at least one event");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await registerWebhook({ url, events: selectedEvents });
      setOpen(false);
      setUrl("");
      setSelectedEvents([...ALL_EVENTS]);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register webhook");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWebhook(id);
      onChanged();
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <WebhookIcon className="h-5 w-5" />
          Webhooks
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Webhook</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Events</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map((event) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                    >
                      <Badge variant={selectedEvents.includes(event) ? "default" : "outline"}>
                        {event}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Registering..." : "Register Webhook"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No webhooks registered</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="flex items-start justify-between rounded-lg border p-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {wh.events.map((ev) => (
                      <Badge key={ev} variant="secondary" className="text-xs">
                        {ev.replace("payment.", "")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => handleDelete(wh.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
