import { describe, expect, it } from "vitest";

import { WriteDeniedError } from "../src/ads/index.js";
import { createToolDefinitions } from "../src/tools/index.js";

function createAdsServiceStub() {
  return {
    listSymbols: async () => [
      {
        name: "MAIN.value",
        type: "INT",
        size: 2,
        comment: "",
        flags: 0,
        indexGroup: 1,
        indexOffset: 2,
      },
    ],
    readValue: async (name: string) => ({
      name,
      value: 1,
      type: "INT",
      timestamp: "2026-01-01T00:00:00.000Z",
      symbol: { name, type: "INT" },
    }),
    readMany: async (names: string[]) =>
      names.map((name) => ({
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name, type: "INT" },
      })),
    readState: async () => ({
      connection: { connected: true },
      adsState: "connected" as const,
      writeMode: "read-only" as const,
      watchCount: 0,
      writePolicy: {
        configReadOnly: true,
        runtimeWriteEnabled: false,
        allowlistCount: 0,
      },
      plcRuntimeState: { adsState: 5, deviceState: 0 },
      tcSystemState: { adsState: 5, deviceState: 0 },
      tcSystemExtendedState: {
        adsState: 5,
        deviceState: 0,
        restartIndex: 1,
        version: 3,
        revision: 1,
        build: 4026,
        platform: 1,
        osType: 1,
      },
      deviceInfo: {
        majorVersion: 1,
        minorVersion: 0,
        versionBuild: 1,
        deviceName: "Mock PLC",
      },
    }),
    setWriteMode: async (mode: "read-only" | "enabled") => ({
      writeMode: mode,
      runtimeWriteEnabled: mode === "enabled",
      configReadOnly: false,
      writesAllowed: mode === "enabled",
      message: "ok",
    }),
    writeValue: async (name: string, value: unknown) => ({
      value,
      dataType: { name: "INT" },
      symbol: { name },
    }),
    watchValue: async (name: string) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: true,
      unsubscribe: async () => undefined,
    }),
    unwatchValue: async (name: string) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: false,
    }),
    listWatches: () => [],
  };
}

describe("tools", () => {
  it("validates read_many input", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_read_many");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { names: [] },
      { adsService: createAdsServiceStub() as never },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TOOL_INPUT_INVALID");
    }
  });

  it("returns WRITE_DENIED when plc_write is blocked", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_write");
    expect(tool).toBeDefined();

    const adsService = {
      ...createAdsServiceStub(),
      writeValue: async () => {
        throw new WriteDeniedError(
          "PLC writes are blocked by the runtime write gate. Enable writes explicitly before calling plc_write.",
        );
      },
    };

    const result = await tool!.execute(
      { name: "MAIN.value", value: 7 },
      { adsService: adsService as never },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WRITE_DENIED");
    }
  });

  it("returns watch snapshots without function values", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_watch");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { name: "MAIN.watch" },
      { adsService: createAdsServiceStub() as never },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("unsubscribe" in result.data.watch).toBe(false);
      expect(result.data.watch.notificationHandle).toBe(123);
    }
  });
});
