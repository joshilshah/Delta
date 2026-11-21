import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Keeps server state fresh. Supabase Realtime (postgres_changes, filtered by RLS) triggers an
 * immediate refetch; polling runs regardless as the reliable fallback, so refreshes, dropped
 * sockets and reconnects always recover the true state from the database via the API.
 */
export function useLive(fetcher, { intervalMs = 3000, realtime, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  const refresh = useCallback(async () => {
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const table = realtime?.table;
  const filter = realtime?.filter;

  useEffect(() => {
    if (!enabled) return undefined;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    let channel;
    if (supabase && table) {
      channel = supabase
        .channel(`live-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2, 7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, refresh)
        .subscribe();
    }
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, intervalMs, refresh, table, filter]);

  return { data, error, loading, refresh, setData };
}

/** Seconds remaining until a deadline derived from a server-provided "seconds left". */
export function useCountdown(secondsLeft, key) {
  const [left, setLeft] = useState(secondsLeft ?? 0);
  useEffect(() => {
    if (secondsLeft == null) return undefined;
    const deadline = Date.now() + secondsLeft * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [secondsLeft, key]);
  return secondsLeft == null ? null : left;
}
