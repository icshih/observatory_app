import { useState, useEffect, useRef } from "react";

export function useMountStatus(intervalMs = 1000) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const res = await fetch("/api/status", { signal: abortRef.current.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStatus(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) setError(err.message);
      }
    }

    fetchStatus();
    const id = setInterval(fetchStatus, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [intervalMs]);

  return { status, loading, error };
}
