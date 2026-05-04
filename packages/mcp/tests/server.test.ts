import { describe, expect, it } from "vitest";

import {
  callMcpTool,
  createMcpToolDefinitions,
} from "../src/index.js";
import type { TwinCatAdsRuntime } from "twincat-mcp-core";

function createRuntimeStub(
  overrides: Partial<Record<keyof TwinCatAdsRuntime, unknown>> = {},
): TwinCatAdsRuntime {
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
    readMany: async ({ names }: { names: readonly string[] }) =>
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
    ncState: async () => ({
      connection: { connected: true },
      adsState: "connected" as const,
      ncRuntimeState: { adsState: 5, deviceState: 0 },
      ncRuntimeStatus: {
        adsState: 5,
        adsStateName: "Run",
        deviceState: 0,
        isRun: true,
        isStop: false,
      },
      deviceInfo: { deviceName: "Mock NC" },
      axes: [{ name: "X", id: 1, targetAdsPort: 500 }],
    }),
    ncListAxes: () => [{ name: "X", id: 1, targetAdsPort: 500 }],
    ncReadAxis: async ({ axis }: { axis: string | number }) => ({
      axis: { name: String(axis), id: 1, targetAdsPort: 500 },
      timestamp: "2026-01-01T00:00:00.000Z",
      online: {
        errorState: 0,
        actualPosition: 12.5,
        moduloActualPosition: 12.5,
        setPosition: 13.5,
        moduloSetPosition: 13.5,
        actualVelocity: 2.5,
        setVelocity: 3.5,
        velocityOverride: 1000000,
        lagErrorPosition: 0,
        controllerOutputPercent: 0,
        totalOutputPercent: 0,
        stateDWord: 0,
      },
      status: {
        ready: true,
        referenced: true,
        protectedMode: false,
        logicalStandstill: false,
        referencing: false,
        inPositionWindow: true,
        atTargetPosition: false,
        constantVelocity: true,
        busy: false,
      },
      errorCode: 0,
    }),
    ncReadAxisMany: async ({ axes }: { axes: Array<string | number> }) => ({
      results: axes.map((axis) => ({
        axis: { name: String(axis), id: 1, targetAdsPort: 500 },
        timestamp: "2026-01-01T00:00:00.000Z",
        online: {
          errorState: 0,
          actualPosition: 12.5,
          moduloActualPosition: 12.5,
          setPosition: 13.5,
          moduloSetPosition: 13.5,
          actualVelocity: 2.5,
          setVelocity: 3.5,
          velocityOverride: 1000000,
          lagErrorPosition: 0,
          controllerOutputPercent: 0,
          totalOutputPercent: 0,
          stateDWord: 0,
        },
        status: {
          ready: true,
          referenced: true,
          protectedMode: false,
          logicalStandstill: false,
          referencing: false,
          inPositionWindow: true,
          atTargetPosition: false,
          constantVelocity: true,
          busy: false,
        },
        errorCode: 0,
      })),
      count: axes.length,
    }),
    ncReadError: async ({ axis }: { axis: string | number }) => ({
      axis: { name: String(axis), id: 1, targetAdsPort: 500 },
      timestamp: "2026-01-01T00:00:00.000Z",
      errorCode: 0,
      hasError: false,
    }),
    ioListGroups: () => ({
      groups: [{ name: "inputs", dataPoints: ["Input1"], count: 1 }],
      dataPoints: [
        {
          name: "Input1",
          indexGroup: 0xf020,
          indexOffset: 0x1f400,
          type: "BOOL",
          size: 1,
        },
      ],
      count: 1,
    }),
    ioRead: async ({ name }: { name: string }) => ({
      dataPoint: {
        name,
        indexGroup: 0xf020,
        indexOffset: 0x1f400,
        type: "BOOL",
        size: 1,
      },
      value: true,
      rawHex: "01",
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
    ioReadMany: async ({ names }: { names: string[] }) => ({
      results: names.map((name) => ({
        dataPoint: {
          name,
          indexGroup: 0xf020,
          indexOffset: 0x1f400,
          type: "BOOL",
          size: 1,
        },
        value: true,
        rawHex: "01",
        timestamp: "2026-01-01T00:00:00.000Z",
      })),
      count: names.length,
    }),
    ioReadGroup: async ({ group }: { group: string }) => ({
      group,
      dataPoints: ["Input1"],
      results: [
        {
          dataPoint: {
            name: "Input1",
            indexGroup: 0xf020,
            indexOffset: 0x1f400,
            type: "BOOL",
            size: 1,
          },
          value: true,
          rawHex: "01",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      count: 1,
    }),
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
      plcRuntimeStatus: {
        adsState: 5,
        adsStateName: "Run",
        deviceState: 0,
        isRun: true,
        isStop: false,
      },
      tcSystemState: { adsState: 5, deviceState: 0 },
      tcSystemStatus: {
        adsState: 5,
        adsStateName: "Run",
        deviceState: 0,
        isRun: true,
        isStop: false,
      },
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

  return { ...runtime, ...overrides } as unknown as TwinCatAdsRuntime;
}

describe("mcp tool definitions", () => {
  it("exposes core operations as MCP tools with JSON object schemas", () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual([
      "ads_connect",
      "ads_disconnect",
      "plc_list_symbols",
      "plc_describe_symbol",
      "plc_read",
      "plc_read_many",
      "plc_list_groups",
      "plc_read_group",
      "nc_state",
      "nc_list_axes",
      "nc_read_axis",
      "nc_read_axis_many",
      "nc_read_error",
      "io_list_groups",
      "io_read",
      "io_read_many",
      "io_read_group",
      "plc_write",
      "plc_watch",
      "plc_wait_until",
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

  it("serializes PLC bigint values as strings in MCP results", async () => {
    const tools = createMcpToolDefinitions(
      createRuntimeStub({
        readSymbol: async ({ name }: { name: string }) => ({
          name,
          value: 9_223_372_036_854_775_807n,
          type: "LINT",
          timestamp: "2026-01-01T00:00:00.000Z",
          symbol: { name, type: "LINT" },
        }),
      }),
    );
    const result = await callMcpTool(tools, "plc_read", {
      name: "MAIN.large",
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      result: {
        name: "MAIN.large",
        value: "9223372036854775807",
        type: "LINT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name: "MAIN.large", type: "LINT" },
      },
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining('"9223372036854775807"'),
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

  it("dispatches NC and IO read-only tools", async () => {
    const tools = createMcpToolDefinitions(createRuntimeStub());

    const ncResult = await callMcpTool(tools, "nc_read_axis", { axis: "X" });
    expect(ncResult.isError).toBeUndefined();
    expect(ncResult.structuredContent).toMatchObject({
      result: {
        axis: { name: "X" },
        online: { actualPosition: 12.5 },
      },
    });

    const ioResult = await callMcpTool(tools, "io_read_group", {
      group: "inputs",
    });
    expect(ioResult.isError).toBeUndefined();
    expect(ioResult.structuredContent).toMatchObject({
      group: {
        results: [{ value: true }],
      },
    });
  });
});
