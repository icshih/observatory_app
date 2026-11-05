import { useEffect, useState } from "react";

/**
 * Fetches GET /api/mount/info (site location, capabilities, slew limit)
 * once each time the mount becomes connected; clears it on disconnect.
 * Retries every few seconds if the request fails while connected.
 */
export function useMountInfo(connected, retryMs = 5000) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!connected) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    let timer = null;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/mount/info", { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setInfo(data);
      } catch (err) {
        if (cancelled || err.name === "AbortError") return;
        timer = setTimeout(load, retryMs);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [connected, retryMs]);

  return info;
}
