import { describe, expect, it } from "vitest";

import { WriteDeniedError } from "../src/ads/index.js";
import { createToolDefinitions } from "../src/tools/index.js";

function createRuntimeStub() {
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
    describeSymbol: async ({ name }: { name: string }) => ({
      name,
      type: "INT",
      size: 2,
      comment: "",
      flags: 0,
      indexGroup: 1,
      indexOffset: 2,
    }),
    readSymbol: async ({ name }: { name: string }) => ({
      name,
      value: 1,
      type: "INT",
      timestamp: "2026-01-01T00:00:00.000Z",
      symbol: { name, type: "INT" },
    }),
    readMany: async ({ names }: { names: string[] }) =>
      names.map((name) => ({
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name, type: "INT" },
      })),
    listGroups: () => [
      {
        name: "status",
        symbols: ["MAIN.value"],
        count: 1,
      },
    ],
    readGroup: async ({ group }: { group: string }) => ({
      group,
      symbols: ["MAIN.value"],
      results: [
        {
          name: "MAIN.value",
          value: 1,
          type: "INT",
          timestamp: "2026-01-01T00:00:00.000Z",
          symbol: { name: "MAIN.value", type: "INT" },
        },
      ],
      count: 1,
    }),
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
    setWriteMode: async ({ mode }: { mode: "read-only" | "enabled" }) => ({
      writeMode: mode,
      runtimeWriteEnabled: mode === "enabled",
      configReadOnly: false,
      writesAllowed: mode === "enabled",
      message: "ok",
    }),
    writeSymbol: async ({ name, value }: { name: string; value: unknown }) => ({
      value,
      dataType: { name: "INT" },
      symbol: { name },
    }),
    watchSymbol: async ({ name }: { name: string }) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: true,
    }),
    unwatchSymbol: async ({ name }: { name: string }) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: false,
    }),
    listWatches: () => [],
    waitUntil: async ({ timeoutMs }: { timeoutMs: number }) => ({
      status: "fulfilled" as const,
      conditionMatched: true,
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.010Z",
      durationMs: 10,
      timeoutMs,
      stableForMs: 0,
      values: [],
    }),
  };
}

describe("tools", () => {
  it("validates read_many input", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_read_many");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { names: [] },
      { runtime: createRuntimeStub() as never },
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

    const runtime = {
      ...createRuntimeStub(),
      writeSymbol: async () => {
        throw new WriteDeniedError(
          "PLC writes are blocked by the runtime write gate. Enable writes explicitly before calling plc_write.",
        );
      },
    };

    const result = await tool!.execute(
      { name: "MAIN.value", value: 7 },
      { runtime: runtime as never },
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
      { runtime: createRuntimeStub() as never },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("unsubscribe" in result.data.watch).toBe(false);
      expect(result.data.watch.notificationHandle).toBe(123);
    }
  });

  it("returns configured PLC groups", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_list_groups");
    expect(tool).toBeDefined();

    const result = await tool!.execute({}, { runtime: createRuntimeStub() as never });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.count).toBe(1);
      expect(result.data.groups[0]?.name).toBe("status");
    }
  });

  it("passes AbortSignal through plc_wait_until", async () => {
    const tools = createToolDefinitions();
    const tool = tools.find((entry) => entry.name === "plc_wait_until");
    expect(tool).toBeDefined();

    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const runtime = {
      ...createRuntimeStub(),
      waitUntil: async ({ signal }: { signal?: AbortSignal }) => {
        receivedSignal = signal;
        return {
          status: "cancelled" as const,
          conditionMatched: false,
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:00.001Z",
          durationMs: 1,
          timeoutMs: 100,
          stableForMs: 0,
          values: [],
        };
      },
    };

    const result = await tool!.execute(
      {
        condition: { name: "MAIN.watch", operator: "equals", value: true },
        timeoutMs: 100,
      },
      {
        runtime: runtime as never,
        signal: controller.signal,
      },
    );

    expect(result.ok).toBe(true);
    expect(receivedSignal).toBe(controller.signal);
  });
});
