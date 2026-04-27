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
    connect: async () => ({ connected: true }),
    disconnect: async () => undefined,
    listSymbols: async (filter) => {
      calls.push(`listSymbols:${filter ?? ""}`);
      return [];
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
    await runtime.readSymbol({ name: "MAIN.value" });
    await runtime.readMany({ names: ["MAIN.a", "MAIN.b"] });
    await runtime.writeSymbol({ name: "MAIN.value", value: 7 });
    await runtime.watchSymbol({ name: "MAIN.value" });
    await runtime.unwatchSymbol({ name: "MAIN.value" });
    runtime.listWatches();
    await runtime.readState();
    await runtime.setWriteMode({ mode: "enabled" });
    runtime.getWriteModeState();
    runtime.evaluateWriteAccess("MAIN.value");

    expect(calls).toEqual([
      "listSymbols:MAIN",
      "readSymbol:MAIN.value",
      "readMany:MAIN.a,MAIN.b",
      "writeSymbol:MAIN.value",
      "watchSymbol:MAIN.value",
      "unwatchSymbol:MAIN.value",
      "listWatches",
      "readState",
      "setWriteMode:enabled",
      "getWriteModeState",
      "canWrite:MAIN.value",
    ]);
  });
});
