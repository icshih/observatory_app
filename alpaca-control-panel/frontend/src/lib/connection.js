/**
 * Classify the mount connection from a /api/status response.
 *
 * @param {object|null} status
 * @returns {{ state: "unknown"|"unreachable"|"disconnected"|"connected",
 *             label: string, detail: string|null }}
 */
export function connectionState(status) {
  if (!status) return { state: "unknown", label: "Checking…", detail: null };
  if (status.connected) return { state: "connected", label: "Connected", detail: null };
  // `reachable` is absent on older backends — treat as reachable.
  if (status.reachable === false) {
    return { state: "unreachable", label: "Device unreachable", detail: status.error ?? null };
  }
  return { state: "disconnected", label: "Disconnected", detail: status.error ?? null };
}
