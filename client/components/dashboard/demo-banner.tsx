"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const REPO_URL = "https://github.com/HenryBuilds/ethereum-payment-processor";

export function DemoBanner() {
  const [bannerVisible, setBannerVisible] = useState(DEMO_MODE);

  if (!DEMO_MODE || !bannerVisible) return null;

  return (
    <div className="shrink-0 bg-[#627eea]/10 border-b border-[#627eea]/20 px-4 flex items-center justify-center h-8 gap-2 text-xs">
      <Badge variant="outline" className="text-[10px] border-[#627eea]/30 text-[#627eea]">DEMO</Badge>
      <span className="text-muted-foreground">
        This is a demo instance with mock data.
      </span>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-[#627eea] hover:underline font-medium">
        View on GitHub
      </a>
      <button onClick={() => setBannerVisible(false)} className="ml-auto text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demo Mode</DialogTitle>
          <DialogDescription>
            This is a demo instance. Creating payments is disabled. Clone the repository to run your own instance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
            <p className="font-medium">Features included:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li>ETH & ERC-20 payments (USDT, USDC, DAI)</li>
              <li>Auto-forwarding to master wallet</li>
              <li>Merchant management & API keys</li>
              <li>Webhook notifications with HMAC signing</li>
              <li>Analytics & CSV/JSON export</li>
              <li>PostgreSQL + Drizzle ORM</li>
            </ul>
          </div>
          <Button
            className="w-full gap-2"
            onClick={() => window.open(REPO_URL, "_blank")}
          >
            <GithubIcon className="h-4 w-4" />
            View on GitHub
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
