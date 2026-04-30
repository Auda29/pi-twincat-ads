import { describe, expect, it, vi } from "vitest";

import { createHookDefinitions } from "../src/hooks/index.js";

function createHookContext() {
  return {
    config: {
      connectionMode: "router" as const,
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: false,
      writeAllowlist: ["MAIN.value"],
      contextSnapshotSymbols: ["MAIN.value"],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    },
    runtime: {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(async () => undefined),
      readState: vi.fn(async () => ({
        connection: { connected: true },
        adsState: "connected" as const,
        writeMode: "read-only" as const,
        watchCount: 0,
        writePolicy: {
          configReadOnly: false,
          runtimeWriteEnabled: false,
          allowlistCount: 1,
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
      })),
      readSymbol: vi.fn(async ({ name }: { name: string }) => ({
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name, type: "INT" },
      })),
      listWatches: vi.fn(() => []),
      getWriteModeState: vi.fn(() => ({
        writeMode: "read-only" as const,
        runtimeWriteEnabled: false,
        configReadOnly: false,
        writesAllowed: false,
        message: "blocked",
      })),
      evaluateWriteAccess: vi.fn(() => ({
        allow: false,
        reason: "PLC writes are blocked by the runtime write gate.",
      })),
    },
  };
}

describe("hooks", () => {
  it("session_start connects and reads configured snapshots", async () => {
    const hooks = createHookDefinitions();
    const hook = hooks.find((entry) => entry.name === "session_start");
    expect(hook).toBeDefined();

    const context = createHookContext();
    const result = await hook!.execute({}, context as never);

    expect(result.ok).toBe(true);
    expect(context.runtime.connect).toHaveBeenCalledOnce();
    expect(context.runtime.readSymbol).toHaveBeenCalledWith({
      name: "MAIN.value",
    });
    if (result.ok) {
      expect(result.data.failedSnapshots).toEqual([]);
    }
  });

  it("tool_call blocks plc_write when arguments are missing", async () => {
    const hooks = createHookDefinitions();
    const hook = hooks.find((entry) => entry.name === "tool_call");
    expect(hook).toBeDefined();

    const context = createHookContext();
    const result = await hook!.execute(
      { toolName: "plc_write", arguments: {} },
      context as never,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allow).toBe(false);
      expect(result.data.reason).toContain("arguments.name");
    }
  });

  it("before_agent_start and context expose failed snapshots", async () => {
    const hooks = createHookDefinitions();
    const beforeAgentStart = hooks.find(
      (entry) => entry.name === "before_agent_start",
    );
    const contextHook = hooks.find((entry) => entry.name === "context");
    expect(beforeAgentStart).toBeDefined();
    expect(contextHook).toBeDefined();

    const context = createHookContext();
    context.config.contextSnapshotSymbols = ["MAIN.value", "MAIN.missing"];
    context.runtime.readSymbol = vi.fn(async ({ name }: { name: string }) => {
      if (name === "MAIN.missing") {
        throw new Error("missing");
      }

      return {
        name,
        value: 1,
        type: "INT",
        timestamp: "2026-01-01T00:00:00.000Z",
        symbol: { name, type: "INT" },
      };
    });

    const startResult = await beforeAgentStart!.execute({}, context as never);
    const liveResult = await contextHook!.execute({}, context as never);

    expect(startResult.ok).toBe(true);
    expect(liveResult.ok).toBe(true);
    if (startResult.ok) {
      expect(startResult.data.summary.failedSnapshots).toEqual(["MAIN.missing"]);
    }
    if (liveResult.ok) {
      expect(liveResult.data.context.failedSnapshots).toEqual(["MAIN.missing"]);
    }
  });

  it("tool_call allows plc_set_write_mode read-only even when config is read-only", async () => {
    const hooks = createHookDefinitions();
    const hook = hooks.find((entry) => entry.name === "tool_call");
    expect(hook).toBeDefined();

    const context = createHookContext();
    context.runtime.getWriteModeState = vi.fn(() => ({
      writeMode: "read-only" as const,
      runtimeWriteEnabled: false,
      configReadOnly: true,
      writesAllowed: false,
      message: "blocked",
    }));

    const result = await hook!.execute(
      { toolName: "plc_set_write_mode", arguments: { mode: "read-only" } },
      context as never,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allow).toBe(true);
    }
  });

  it("session_end disconnects cleanly", async () => {
    const hooks = createHookDefinitions();
    const hook = hooks.find((entry) => entry.name === "session_end");
    expect(hook).toBeDefined();

    const context = createHookContext();
    const result = await hook!.execute({}, context as never);

    expect(result.ok).toBe(true);
    expect(context.runtime.disconnect).toHaveBeenCalledOnce();
  });
});
