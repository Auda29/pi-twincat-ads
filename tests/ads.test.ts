import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  connectCalls: 0,
  createHandleCalls: 0,
  deleteHandleCalls: 0,
  subscribeCalls: 0,
  unsubscribeCalls: 0,
  symbols: {
    "MAIN.value": {
      name: "MAIN.value",
      type: "INT",
      comment: "Test value",
      size: 2,
      flags: 0,
      indexGroup: 1,
      indexOffset: 2,
    },
    "MAIN.watch": {
      name: "MAIN.watch",
      type: "BOOL",
      comment: "Watch value",
      size: 1,
      flags: 0,
      indexGroup: 3,
      indexOffset: 4,
    },
  } as Record<string, any>,
  values: {
    "MAIN.value": 42,
    "MAIN.watch": true,
  } as Record<string, unknown>,
  clientInstances: [] as MockClient[],
  nextNotificationHandle: 100,
}));

class MockClient extends EventEmitter {
  settings: Record<string, unknown>;
  connection = {
    connected: false,
    localAmsNetId: "1.1.1.1.1.1",
    localAdsPort: 30000,
    targetAmsNetId: "192.168.1.120.1.1",
    targetAdsPort: 851,
  };
  activeSubscriptions: Record<string, Record<number, any>> = {};

  constructor(settings: Record<string, unknown>) {
    super();
    this.settings = settings;
    mockState.clientInstances.push(this);
  }

  async connect() {
    mockState.connectCalls += 1;
    this.connection.connected = true;
    return this.connection;
  }

  async disconnect() {
    this.connection.connected = false;
  }

  async cacheSymbols() {}

  async cacheDataTypes() {}

  async getSymbols() {
    return mockState.symbols;
  }

  async readValue(name: string) {
    const symbol = mockState.symbols[name];
    if (!symbol) {
      throw new Error(`Unknown symbol ${name}`);
    }

    return {
      value: mockState.values[name],
      rawValue: Buffer.from(String(mockState.values[name])),
      dataType: { name: symbol.type },
      symbol,
    };
  }

  async readRawMulti(commands: Array<{ indexGroup: number; indexOffset: number }>) {
    return commands.map((command) => {
      const symbol = Object.values(mockState.symbols).find(
        (entry) =>
          entry.indexGroup === command.indexGroup &&
          entry.indexOffset === command.indexOffset,
      );

      return {
        success: true,
        command,
        value: Buffer.from(String(mockState.values[symbol?.name ?? ""] ?? "")),
      };
    });
  }

  async convertFromRaw(buffer: Buffer) {
    const value = buffer.toString();
    return Number.isNaN(Number(value)) ? value : Number(value);
  }

  async writeValue(name: string, value: unknown) {
    const symbol = mockState.symbols[name];
    mockState.values[name] = value;
    return {
      value,
      rawValue: Buffer.from(String(value)),
      dataType: { name: symbol.type },
      symbol,
    };
  }

  async readPlcRuntimeState() {
    return { adsState: 5, deviceState: 0 };
  }

  async readTcSystemState() {
    return { adsState: 5, deviceState: 0 };
  }

  async readTcSystemExtendedState() {
    return {
      adsState: 5,
      deviceState: 0,
      restartIndex: 1,
      version: 3,
      revision: 1,
      build: 4026,
      platform: 1,
      osType: 1,
    };
  }

  async readDeviceInfo() {
    return {
      majorVersion: 1,
      minorVersion: 2,
      versionBuild: 3,
      deviceName: "Mock PLC",
    };
  }

  async subscribeValue(
    path: string,
    callback: (data: { timestamp: Date; value: unknown }, subscription: any) => void,
    cycleTime?: number,
    sendOnChange?: boolean,
    maxDelay?: number,
  ) {
    mockState.subscribeCalls += 1;
    const remoteAddress = {
      amsNetId: this.connection.targetAmsNetId,
      adsPort: this.connection.targetAdsPort,
    };
    const notificationHandle = mockState.nextNotificationHandle++;
    const latestData = {
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      value: mockState.values[path],
    };
    const subscription = {
      settings: {
        target: path,
        callback,
        cycleTime,
        sendOnChange,
        maxDelay,
      },
      internal: false,
      remoteAddress,
      notificationHandle,
      symbol: mockState.symbols[path],
      latestData,
      unsubscribe: async () => {
        mockState.unsubscribeCalls += 1;
        delete this.activeSubscriptions[`${remoteAddress.amsNetId}:${remoteAddress.adsPort}`]?.[
          notificationHandle
        ];
      },
    };
    const key = `${remoteAddress.amsNetId}:${remoteAddress.adsPort}`;
    this.activeSubscriptions[key] ??= {};
    this.activeSubscriptions[key][notificationHandle] = subscription;
    return subscription;
  }

  async unsubscribe(subscription: { unsubscribe: () => Promise<void> }) {
    await subscription.unsubscribe();
  }

  async createVariableHandle() {
    mockState.createHandleCalls += 1;
    return {
      handle: 777,
      size: 2,
      typeDecoration: 0,
      dataType: "INT",
    };
  }

  async deleteVariableHandle() {
    mockState.deleteHandleCalls += 1;
  }
}

vi.mock("ads-client", () => ({
  ADS: {},
  Client: MockClient,
}));

describe("AdsService", () => {
  beforeEach(() => {
    mockState.connectCalls = 0;
    mockState.createHandleCalls = 0;
    mockState.deleteHandleCalls = 0;
    mockState.subscribeCalls = 0;
    mockState.unsubscribeCalls = 0;
    mockState.nextNotificationHandle = 100;
    mockState.clientInstances.length = 0;
    mockState.values["MAIN.value"] = 42;
    mockState.values["MAIN.watch"] = true;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("deduplicates concurrent connect calls", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: [],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    await Promise.all([service.connect(), service.connect()]);

    expect(mockState.connectCalls).toBe(1);
  });

  it("enforces the runtime write gate before writing", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: false,
      writeAllowlist: ["MAIN.value"],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    await expect(service.writeValue("MAIN.value", 7)).rejects.toThrow(
      "runtime write gate",
    );

    service.setWriteMode("enabled");
    const result = await service.writeValue("MAIN.value", 7);
    expect(result.value).toBe(7);
  });

  it("reuses handles and releases them", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: [],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    const handleA = await service.getOrCreateHandle("MAIN.value");
    const handleB = await service.getOrCreateHandle("MAIN.value");

    expect(handleA.handle).toBe(handleB.handle);
    expect(mockState.createHandleCalls).toBe(1);

    await service.releaseHandle("MAIN.value");
    expect(mockState.deleteHandleCalls).toBe(1);
  });

  it("registers, lists, and idempotently removes watches", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: [],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    const watch = await service.watchValue("MAIN.watch");
    expect(watch.active).toBe(true);
    expect(watch.lastValue).toBe(true);
    expect(watch.lastTimestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(service.listWatches()).toHaveLength(1);

    const removed = await service.unwatchValue("MAIN.watch");
    expect(removed.active).toBe(false);
    expect(service.listWatches()).toHaveLength(0);

    const missing = await service.unwatchValue("MAIN.watch");
    expect(missing.active).toBe(false);
  });

  it("rebinds watch subscriptions after reconnect", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: [],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    const firstWatch = await service.watchValue("MAIN.watch");
    const client = mockState.clientInstances.at(-1);
    expect(client).toBeDefined();

    client!.activeSubscriptions = {
      "192.168.1.120.1.1:851": {
        999: {
          ...(await client!.subscribeValue("MAIN.watch", () => undefined)),
          notificationHandle: 999,
          settings: {
            target: "MAIN.watch",
          },
          latestData: {
            timestamp: new Date("2026-01-02T00:00:00.000Z"),
            value: false,
          },
        },
      },
    };

    client!.emit("reconnect", true, []);
    await vi.waitFor(() => {
      expect(service.listWatches()[0]?.notificationHandle).toBe(999);
    });

    expect(firstWatch.notificationHandle).not.toBe(999);
  });

  it("evaluates write access across all gate states", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const readOnlyService = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: ["MAIN.value"],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    expect(readOnlyService.evaluateWriteAccess("MAIN.value")).toEqual({
      allow: false,
      reason: "PLC writes are disabled by configuration because readOnly is true.",
    });

    const gatedService = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: false,
      writeAllowlist: ["MAIN.value"],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    expect(gatedService.evaluateWriteAccess("MAIN.value")).toEqual({
      allow: false,
      reason:
        "PLC writes are blocked by the runtime write gate. Enable writes explicitly before calling plc_write.",
    });

    gatedService.setWriteMode("enabled");
    expect(gatedService.evaluateWriteAccess("MAIN.other").allow).toBe(false);
    expect(gatedService.evaluateWriteAccess("MAIN.value")).toEqual({
      allow: true,
    });
  });

  it("reads many symbols via raw multi read", async () => {
    const { AdsService } = await import("../src/ads/index.js");

    const service = new AdsService({
      connectionMode: "router",
      targetAmsNetId: "192.168.1.120.1.1",
      targetAdsPort: 851,
      readOnly: true,
      writeAllowlist: [],
      contextSnapshotSymbols: [],
      notificationCycleTimeMs: 250,
      maxNotifications: 128,
    });

    const results = await service.readMany(["MAIN.value", "MAIN.watch"]);

    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe("MAIN.value");
    expect(results[0]?.value).toBe(42);
    expect(results[1]?.name).toBe("MAIN.watch");
  });
});
