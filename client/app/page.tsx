"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EthPriceCard } from "@/components/dashboard/eth-price-card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { VolumeTimeline } from "@/components/dashboard/volume-timeline";
import { StatusChart } from "@/components/dashboard/status-chart";
import { SuccessRate } from "@/components/dashboard/success-rate";
import { PaymentsTable } from "@/components/dashboard/payments-table";
import { CreatePaymentDialog } from "@/components/dashboard/create-payment-dialog";
import { MerchantsPanel } from "@/components/dashboard/merchants-panel";
import { WebhooksPanel } from "@/components/dashboard/webhooks-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useState } from "react";
import { useDashboard } from "@/hooks/use-dashboard";
import { exportPayments } from "@/lib/api";
import { DemoBanner, DemoDialog, DEMO_MODE } from "@/components/dashboard/demo-banner";
import { RefreshCw, Download, Plus } from "lucide-react";

export default function Dashboard() {
  const {
    payments, allPayments, analytics, ethPrice, merchants, webhooks,
    pagination, statusFilter, loading, refreshing,
    refresh, cancelPayment, changeStatusFilter, setPage,
  } = useDashboard();

  const [demoDialogOpen, setDemoDialogOpen] = useState(false);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden bg-background">
      <DemoBanner />
      {DEMO_MODE && <DemoDialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen} />}
      {/* Header */}
      <header className="border-b shrink-0 px-4 md:px-5 flex h-12 items-center justify-between">
        <h1 className="text-sm font-bold tracking-tight">ETH Payment Processor</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {DEMO_MODE ? (
            <Button onClick={() => setDemoDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          ) : (
            <CreatePaymentDialog onCreated={refresh} />
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 p-3 md:p-4 flex flex-col gap-3 md:gap-4 overflow-auto lg:overflow-hidden">
        {/* Top: Cards + Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 shrink-0 lg:min-h-[280px]">
          {/* ETH Price + Stats */}
          <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-3">
            <EthPriceCard ethPrice={ethPrice} loading={loading} />
            <StatsCards analytics={analytics} loading={loading} />
          </div>

          {/* Volume Chart */}
          <div className="sm:col-span-2 lg:col-span-5 min-h-[220px] lg:min-h-0">
            <VolumeTimeline payments={allPayments} loading={loading} />
          </div>

          {/* Status Donut */}
          <div className="sm:col-span-1 lg:col-span-2 min-h-[220px] lg:min-h-0">
            <StatusChart analytics={analytics} loading={loading} />
          </div>

          {/* Success Rate + Overview */}
          <div className="sm:col-span-1 lg:col-span-3 min-h-[220px] lg:min-h-0">
            <SuccessRate analytics={analytics} loading={loading} />
          </div>
        </div>

        {/* Bottom: Table + Activity */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Tabs Card */}
          <div className="lg:col-span-9 flex flex-col min-h-[400px] lg:min-h-0">
            <div className="flex flex-col flex-1 min-h-0 rounded-xl border bg-card text-card-foreground shadow-sm">
              <Tabs defaultValue="payments" className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between shrink-0 px-3 md:px-4 pt-3 pb-2 border-b gap-2 flex-wrap">
                  <TabsList>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="merchants">Merchants</TabsTrigger>
                    <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => window.open(exportPayments("csv", { status: statusFilter === "all" ? undefined : statusFilter }), "_blank")}>
                      <Download className="mr-1 h-3 w-3" /> CSV
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => window.open(exportPayments("json", { status: statusFilter === "all" ? undefined : statusFilter }), "_blank")}>
                      <Download className="mr-1 h-3 w-3" /> JSON
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <TabsContent value="payments" className="mt-0">
                    <PaymentsTable
                      payments={payments} loading={loading} pagination={pagination}
                      statusFilter={statusFilter} onStatusFilter={changeStatusFilter}
                      onPageChange={setPage} onCancelPayment={cancelPayment}
                    />
                  </TabsContent>
                  <TabsContent value="merchants" className="mt-0 p-3">
                    <MerchantsPanel merchants={merchants} loading={loading} onCreated={refresh} />
                  </TabsContent>
                  <TabsContent value="webhooks" className="mt-0 p-3">
                    <WebhooksPanel webhooks={webhooks} loading={loading} onChanged={refresh} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          {/* Activity */}
          <div className="lg:col-span-3 min-h-[300px] lg:min-h-0">
            <RecentActivity payments={payments} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}
