import { describe, it, expect } from "vitest";
import { connectionState } from "./connection.js";

describe("connectionState", () => {
  it("is unknown before the first status arrives", () => {
    expect(connectionState(null).state).toBe("unknown");
  });

  it("is connected", () => {
    expect(connectionState({ connected: true, reachable: true })).toEqual({
      state: "connected", label: "Connected", detail: null,
    });
  });

  it("distinguishes unreachable from disconnected", () => {
    expect(
      connectionState({ connected: false, reachable: false, error: "device unreachable (Connection refused)" }),
    ).toEqual({
      state: "unreachable",
      label: "Device unreachable",
      detail: "device unreachable (Connection refused)",
    });
    expect(connectionState({ connected: false, reachable: true }).state).toBe("disconnected");
  });

  it("passes through a device error while reachable", () => {
    const c = connectionState({ connected: false, reachable: true, error: "Driver not initialised" });
    expect(c.state).toBe("disconnected");
    expect(c.detail).toBe("Driver not initialised");
  });

  it("treats a missing `reachable` field as reachable (older backend)", () => {
    expect(connectionState({ connected: false }).state).toBe("disconnected");
  });
});
