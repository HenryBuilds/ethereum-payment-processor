"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { autoFetch = true, refreshInterval } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) refetch();
    return () => { mountedRef.current = false; };
  }, [refetch, autoFetch]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(() => refetch(), refreshInterval);
    return () => clearInterval(id);
  }, [refetch, refreshInterval]);

  return { data, loading, error, refetch };
}
