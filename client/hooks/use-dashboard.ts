"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  getPayments, getAnalytics, getEthPrice, getMerchants, getWebhooks,
  cancelPayment as apiCancelPayment,
} from "@/lib/api";
import type { SafePayment, AnalyticsSummary, Merchant, Webhook } from "@/lib/api";

const REFRESH_INTERVAL = 30_000;

export function useDashboard() {
  const [payments, setPayments] = useState<SafePayment[]>([]);
  const [allPayments, setAllPayments] = useState<SafePayment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number } | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        getPayments({ status: statusFilter === "all" ? undefined : statusFilter, page, limit: 10 }),
        getPayments({ limit: 1000 }),
        getAnalytics(),
        getEthPrice(),
        getMerchants(),
        getWebhooks(),
      ]);

      if (!mountedRef.current) return;

      const [paymentsRes, allRes, analyticsRes, priceRes, merchantsRes, webhooksRes] = results;

      if (paymentsRes.status === "fulfilled") {
        setPayments(paymentsRes.value.data);
        setPagination(paymentsRes.value.pagination);
      }
      if (allRes.status === "fulfilled") setAllPayments(allRes.value.data);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value.data);
      if (priceRes.status === "fulfilled") setEthPrice(priceRes.value.data.ethUsd);
      if (merchantsRes.status === "fulfilled") setMerchants(merchantsRes.value.data);
      if (webhooksRes.status === "fulfilled") setWebhooks(webhooksRes.value.data);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [statusFilter, page]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData(true);
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  // Auto refresh
  useEffect(() => {
    const id = setInterval(() => fetchData(false), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(false), [fetchData]);

  const cancelPayment = useCallback(async (id: string) => {
    try {
      await apiCancelPayment(id);
      await fetchData(false);
    } catch {}
  }, [fetchData]);

  const changeStatusFilter = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  return {
    payments,
    allPayments,
    analytics,
    ethPrice,
    merchants,
    webhooks,
    pagination,
    statusFilter,
    page,
    loading,
    refreshing,
    refresh,
    cancelPayment,
    changeStatusFilter,
    setPage,
  };
}
