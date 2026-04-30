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
