import { describe, expect, it } from "vitest";

import {
  callMcpTool,
  createMcpToolDefinitions,
} from "../src/index.js";
import type { TwinCatAdsRuntime } from "twincat-ads-core";

function createRuntimeStub(): TwinCatAdsRuntime {
  const runtime = {
    connect: async () => ({ connected: true }),
    disconnect: async () => undefined,
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
    readSymbol: async ({ name }: { name: string }) => ({
      name,
      value: 1,
      type: "INT",
      timestamp: "2026-01-01T00:00:00.000Z",
      symbol: { name, type: "INT" },
    }),
    readMany: async ({ names }: { names: readonly string[] }) =>
      names.map((name) => ({
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name, type: "INT" },
      })),
    writeSymbol: async ({ name, value }: { name: string; value: unknown }) => ({
      name,
      value,
      type: "INT",
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
    watchSymbol: async ({ name }: { name: string }) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: true,
      unsubscribe: async () => undefined,
    }),
    unwatchSymbol: async ({ name }: { name: string }) => ({
      name,
      notificationHandle: 123,
      cycleTimeMs: 250,
      mode: "on-change" as const,
      active: false,
    }),
    listWatches: () => [],
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
    getWriteModeState: () => ({
      writeMode: "read-only" as const,
      runtimeWriteEnabled: false,
      configReadOnly: false,
      writesAllowed: false,
      message: "blocked",
    }),
    evaluateWriteAccess: (symbolName: string) => ({
      allow: symbolName === "MAIN.value",
    }),
  };

  return runtime as unknown as TwinCatAdsRuntime;
}

describe("mcp tool definitions", () => {
  it("exposes core operations as MCP tools with JSON object schemas", () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual([
      "ads_connect",
      "ads_disconnect",
      "plc_list_symbols",
      "plc_read",
      "plc_read_many",
      "plc_write",
      "plc_watch",
      "plc_unwatch",
      "plc_list_watches",
      "plc_state",
      "plc_set_write_mode",
      "plc_get_write_mode",
      "plc_evaluate_write_access",
    ]);
  });

  it("dispatches tool calls through the runtime and returns structured JSON", async () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());
    const result = await callMcpTool(tools, "plc_read", {
      name: "MAIN.value",
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      result: {
        name: "MAIN.value",
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name: "MAIN.value", type: "INT" },
      },
    });
  });

  it("returns MCP tool errors for invalid input", async () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());
    const result = await callMcpTool(tools, "plc_read_many", { names: [] });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: "TOOL_INPUT_INVALID" },
    });
  });

  it("serializes watch snapshots without function values", async () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());
    const result = await callMcpTool(tools, "plc_watch", {
      name: "MAIN.watch",
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      watch: {
        name: "MAIN.watch",
        notificationHandle: 123,
        active: true,
      },
    });
    expect(
      "unsubscribe" in
        (result.structuredContent as { watch: Record<string, unknown> }).watch,
    ).toBe(false);
  });
});
