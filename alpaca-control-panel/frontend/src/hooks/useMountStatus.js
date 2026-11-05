import { useState, useEffect } from "react";

// Hard ceiling for a single status request. Longer than the backend's 5 s
// Alpaca timeout so backend errors normally surface as HTTP errors.
const REQUEST_TIMEOUT_MS = 8000;

export function useMountStatus(intervalMs = 1000) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let current = null; // AbortController of the in-flight request, if any

    async function fetchStatus() {
      // Skip this tick while a request is still running instead of aborting
      // it — otherwise a backend slower than intervalMs never returns data
      // and no error is ever shown.
      if (current) return;
      const controller = new AbortController();
      current = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch("/api/status", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStatus(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err.name === "AbortError") {
          if (timedOut) setError("Status request timed out");
        } else {
          setError(err.message);
        }
      } finally {
        clearTimeout(timer);
        current = null;
      }
    }

    fetchStatus();
    const id = setInterval(fetchStatus, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      current?.abort();
    };
  }, [intervalMs]);

  return { status, loading, error };
}
