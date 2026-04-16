import { describe, expect, it } from "vitest";

import { isWriteAllowed, normalizeExtensionConfig } from "../src/config.js";

describe("config", () => {
  it("applies router-mode defaults", () => {
    const config = normalizeExtensionConfig({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
    });

    expect(config.targetAdsPort).toBe(851);
    expect(config.readOnly).toBe(true);
    expect(config.notificationCycleTimeMs).toBe(250);
    expect(config.maxNotifications).toBe(128);
    expect(config.writeAllowlist).toEqual([]);
  });

  it("requires direct-mode connection fields", () => {
    expect(() =>
      normalizeExtensionConfig({
        connectionMode: "direct",
        targetAmsNetId: "192.168.1.120.1.1",
      }),
    ).toThrow();
  });

  it("rejects invalid AMS Net IDs", () => {
    expect(() =>
      normalizeExtensionConfig({
        connectionMode: "router",
        targetAmsNetId: "192.168.1.120.1",
      }),
    ).toThrow("AMS Net ID must contain six numeric segments");
  });

  it("rejects writeAllowlist when readOnly stays enabled", () => {
    expect(() =>
      normalizeExtensionConfig({
        connectionMode: "router",
        targetAmsNetId: "192.168.1.120.1.1",
        readOnly: true,
        writeAllowlist: ["MAIN.bStart"],
      }),
    ).toThrow("writeAllowlist has no effect when readOnly is enabled");
  });

  it("allows exact write allowlist matches only", () => {
    expect(
      isWriteAllowed(
        {
          readOnly: false,
          writeAllowlist: ["MAIN.bStart"],
        },
        "MAIN.bStart",
      ),
    ).toBe(true);

    expect(
      isWriteAllowed(
        {
          readOnly: false,
          writeAllowlist: ["MAIN.bStart"],
        },
        "main.bstart",
      ),
    ).toBe(false);
  });
});
