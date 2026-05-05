import { describe, expect, it } from "vitest";

import {
  createTwinCatAdsRuntime,
  type TwinCatAdsService,
} from "../src/index.js";

function createServiceStub() {
  const calls: string[] = [];
  const service: TwinCatAdsService = {
    state: "connected",
    writeMode: "read-only",
    hasActiveConnection: true,
    listServices: () => [
      {
        name: "plc",
        targetAdsPort: 851,
        connected: true,
        state: "connected",
      },
      {
        name: "nc",
        targetAdsPort: 500,
        connected: false,
        state: "disconnected",
      },
      {
        name: "io",
        targetAdsPort: 300,
        connected: false,
        state: "disconnected",
      },
    ],
    getServiceClient: () => ({}) as never,
    connectService: async () => ({ connected: true }),
    disconnectService: async () => undefined,
    connect: async () => ({ connected: true }),
    disconnect: async () => undefined,
    listSymbols: async (filter) => {
      calls.push(`listSymbols:${filter ?? ""}`);
      return [];
    },
    describeSymbol: async (name) => {
      calls.push(`describeSymbol:${name}`);
      return {
        name,
        type: "INT",
        size: 2,
        comment: "",
        flags: 0,
        indexGroup: 1,
        indexOffset: 2,
      };
    },
    readSymbol: async (name) => {
      calls.push(`readSymbol:${name}`);
      return {
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: {
          name,
          type: "INT",
          size: 2,
          comment: "",
          flags: 0,
          indexGroup: 1,
          indexOffset: 2,
        },
      };
    },
    readMany: async (names) => {
      calls.push(`readMany:${names.join(",")}`);
      return [];
    },
    listGroups: () => {
      calls.push("listGroups");
      return [];
    },
    readGroup: async (group) => {
      calls.push(`readGroup:${group}`);
      return {
        group,
        symbols: [],
        results: [],
        count: 0,
      };
    },
    ncState: async () => {
      calls.push("ncState");
      return {
        connection: { connected: true },
        adsState: "connected",
        ncRuntimeState: { adsState: 5, deviceState: 0 },
        ncRuntimeStatus: {
          adsState: 5,
          adsStateName: "Run",
          deviceState: 0,
          isRun: true,
          isStop: false,
        },
        deviceInfo: {},
        axes: [],
      };
    },
    ncListAxes: () => {
      calls.push("ncListAxes");
      return [];
    },
    ncReadAxis: async (axis) => {
      calls.push(`ncReadAxis:${axis}`);
      return {
        axis: { name: String(axis), id: 1, targetAdsPort: 500 },
        timestamp: "2026-01-01T00:00:00.000Z",
        online: {
          errorState: 0,
          actualPosition: 1,
          moduloActualPosition: 1,
          setPosition: 1,
          moduloSetPosition: 1,
          actualVelocity: 0,
          setVelocity: 0,
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
          logicalStandstill: true,
          referencing: false,
          inPositionWindow: true,
          atTargetPosition: true,
          constantVelocity: false,
          busy: false,
        },
        errorCode: 0,
      };
    },
    ncReadAxisMany: async (axes) => {
      calls.push(`ncReadAxisMany:${axes.join(",")}`);
      return { results: [], count: 0 };
    },
    ncReadError: async (axis) => {
      calls.push(`ncReadError:${axis}`);
      return {
        axis: { name: String(axis), id: 1, targetAdsPort: 500 },
        timestamp: "2026-01-01T00:00:00.000Z",
        errorCode: 0,
        hasError: false,
      };
    },
    ioListGroups: () => {
      calls.push("ioListGroups");
      return { groups: [], dataPoints: [], count: 0 };
    },
    ioRead: async (name) => {
      calls.push(`ioRead:${name}`);
      return {
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
      };
    },
    ioReadMany: async (names) => {
      calls.push(`ioReadMany:${names.join(",")}`);
      return { results: [], count: 0 };
    },
    ioReadGroup: async (group) => {
      calls.push(`ioReadGroup:${group}`);
      return { group, dataPoints: [], results: [], count: 0 };
    },
    tcState: async () => {
      calls.push("tcState");
      return {
        timestamp: "2026-01-01T00:00:00.000Z",
        adsState: "connected",
        services: [],
        plc: {
          available: true,
          data: {
            connection: { connected: true },
            adsState: "connected",
            writeMode: "read-only",
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
            deviceInfo: {},
          },
        },
        nc: { available: false, error: "NC unavailable" },
        diagnostics: { eventSources: [], logSources: [] },
      };
    },
    tcEventList: async () => {
      calls.push("tcEventList");
      return {
        source: "events",
        available: true,
        capability: { id: "events", kind: "windowsEventLog", available: true },
        events: [],
        count: 0,
        truncated: false,
        query: { limit: 50 },
      };
    },
    tcRuntimeErrorList: async () => {
      calls.push("tcRuntimeErrorList");
      return {
        source: "events",
        available: true,
        capability: { id: "events", kind: "windowsEventLog", available: true },
        events: [],
        errors: [],
        count: 0,
        truncated: false,
        query: { limit: 50 },
      };
    },
    tcLogRead: async () => {
      calls.push("tcLogRead");
      return {
        source: "logs",
        available: true,
        capability: { id: "logs", kind: "file", available: true },
        text: "",
        bytesRead: 0,
        truncated: false,
        query: { limitBytes: 1024 },
      };
    },
    writeSymbol: async (name, value) => {
      calls.push(`writeSymbol:${name}`);
      return {
        name,
        value,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
      };
    },
    watchSymbol: async (name) => {
      calls.push(`watchSymbol:${name}`);
      return {
        name,
        notificationHandle: 1,
        cycleTimeMs: 250,
        mode: "on-change",
        active: true,
      };
    },
    waitUntil: async (input) => {
      calls.push(`waitUntil:${input.timeoutMs}`);
      return {
        status: "fulfilled",
        conditionMatched: true,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:00.010Z",
        durationMs: 10,
        timeoutMs: input.timeoutMs,
        stableForMs: input.stableForMs ?? 0,
        values: [],
      };
    },
    unwatchSymbol: async (name) => {
      calls.push(`unwatchSymbol:${name}`);
      return {
        name,
        notificationHandle: 1,
        cycleTimeMs: 250,
        mode: "on-change",
        active: false,
      };
    },
    listWatches: () => {
      calls.push("listWatches");
      return [];
    },
    getWriteModeState: () => {
      calls.push("getWriteModeState");
      return {
        writeMode: "read-only",
        runtimeWriteEnabled: false,
        configReadOnly: true,
        writesAllowed: false,
        message: "blocked",
      };
    },
    canWrite: (symbolName) => {
      calls.push(`canWrite:${symbolName}`);
      return {
        allow: symbolName === "MAIN.value",
      };
    },
    readState: async () => {
      calls.push("readState");
      return {
        connection: { connected: true },
        adsState: "connected",
        writeMode: "read-only",
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
        deviceInfo: {},
      };
    },
    setWriteMode: async (mode) => {
      calls.push(`setWriteMode:${mode}`);
      return {
        writeMode: mode,
        runtimeWriteEnabled: mode === "enabled",
        configReadOnly: false,
        writesAllowed: mode === "enabled",
        message: "ok",
      };
    },
  };

  return { calls, service };
}

describe("core runtime contract", () => {
  it("delegates transport-free operations to the ADS service boundary", async () => {
    const { calls, service } = createServiceStub();
    const runtime = createTwinCatAdsRuntime(service);

    await runtime.listSymbols({ filter: "MAIN" });
    await runtime.describeSymbol({ name: "MAIN.value" });
    await runtime.readSymbol({ name: "MAIN.value" });
    await runtime.readMany({ names: ["MAIN.a", "MAIN.b"] });
    runtime.listGroups();
    await runtime.readGroup({ group: "status" });
    await runtime.ncState();
    runtime.ncListAxes();
    await runtime.ncReadAxis({ axis: "X" });
    await runtime.ncReadAxisMany({ axes: ["X", "Y"] });
    await runtime.ncReadError({ axis: "X" });
    runtime.ioListGroups();
    await runtime.ioRead({ name: "Input1" });
    await runtime.ioReadMany({ names: ["Input1", "Output1"] });
    await runtime.ioReadGroup({ group: "inputs" });
    await runtime.tcState();
    await runtime.tcEventList({ limit: 5 });
    await runtime.tcRuntimeErrorList({ limit: 5 });
    await runtime.tcLogRead({ limitBytes: 1024 });
    await runtime.writeSymbol({ name: "MAIN.value", value: 7 });
    await runtime.watchSymbol({ name: "MAIN.value" });
    await runtime.waitUntil({
      condition: { name: "MAIN.value", operator: "equals", value: 1 },
      timeoutMs: 100,
    });
    await runtime.unwatchSymbol({ name: "MAIN.value" });
    runtime.listWatches();
    await runtime.readState();
    await runtime.setWriteMode({ mode: "enabled" });
    runtime.getWriteModeState();
    runtime.evaluateWriteAccess("MAIN.value");

    expect(calls).toEqual([
      "listSymbols:MAIN",
      "describeSymbol:MAIN.value",
      "readSymbol:MAIN.value",
      "readMany:MAIN.a,MAIN.b",
      "listGroups",
      "readGroup:status",
      "ncState",
      "ncListAxes",
      "ncReadAxis:X",
      "ncReadAxisMany:X,Y",
      "ncReadError:X",
      "ioListGroups",
      "ioRead:Input1",
      "ioReadMany:Input1,Output1",
      "ioReadGroup:inputs",
      "tcState",
      "tcEventList",
      "tcRuntimeErrorList",
      "tcLogRead",
      "writeSymbol:MAIN.value",
      "watchSymbol:MAIN.value",
      "waitUntil:100",
      "unwatchSymbol:MAIN.value",
      "listWatches",
      "readState",
      "setWriteMode:enabled",
      "getWriteModeState",
      "canWrite:MAIN.value",
    ]);
  });
});
