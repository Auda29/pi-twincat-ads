import {
  ADS,
  Client,
  type ActiveSubscription,
  type AdsClientConnection,
  type AdsClientSettings,
  type AdsDataType,
  type AdsDeviceInfo as AdsClientDeviceInfo,
  type AdsState,
  type AdsSymbol,
  type AdsTcSystemExtendedState,
  type ReadRawMultiCommand,
  type ReadValueResult,
  type SubscriptionCallback,
  type SubscriptionData,
  type VariableHandle,
  type WriteValueResult,
} from "ads-client";

import {
  isWriteAllowed,
  type ExtensionRuntimeConfig,
} from "./config.js";

export interface AdsServiceDependencies {
  readonly logger?: Pick<Console, "debug" | "error" | "info" | "warn">;
}

export type AdsConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded";

export type PlcWriteMode = "read-only" | "enabled";
export type PlcWatchMode = "on-change" | "cyclic";
export type AdsConnectionInfo = AdsClientConnection;
export type AdsStateSnapshot = AdsState;
export type AdsDeviceInfo = AdsClientDeviceInfo;

export interface PlcSymbolSummary {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly comment: string;
  readonly flags: number;
  readonly indexGroup: number;
  readonly indexOffset: number;
}

export interface PlcReadResult<T = unknown> {
  readonly name: string;
  readonly value: T;
  readonly type: string;
  readonly timestamp: string;
  readonly symbol: AdsSymbol;
}

export interface PlcWriteResult<T = unknown> {
  readonly name: string;
  readonly value: T;
  readonly type: string;
  readonly timestamp: string;
}

export interface PlcWatchSnapshot<T = unknown> {
  readonly name: string;
  readonly notificationHandle: number;
  readonly cycleTimeMs: number;
  readonly mode: PlcWatchMode;
  readonly active: boolean;
  readonly lastValue?: T;
  readonly lastTimestamp?: string;
}

export interface PlcStateResult {
  readonly connection: AdsClientConnection;
  readonly adsState: AdsConnectionState;
  readonly writeMode: PlcWriteMode;
  readonly watchCount: number;
  readonly writePolicy: {
    readonly configReadOnly: boolean;
    readonly runtimeWriteEnabled: boolean;
    readonly allowlistCount: number;
  };
  readonly plcRuntimeState: AdsState;
  readonly tcSystemState: AdsState;
  readonly tcSystemExtendedState: AdsTcSystemExtendedState;
  readonly deviceInfo: AdsClientDeviceInfo;
}

export interface PlcWatchRegistration extends PlcWatchSnapshot {
  unsubscribe(): Promise<void>;
}

export interface PlcWriteModeResult {
  readonly writeMode: PlcWriteMode;
  readonly runtimeWriteEnabled: boolean;
  readonly configReadOnly: boolean;
  readonly writesAllowed: boolean;
  readonly message: string;
}

export interface PlcWriteAccessResult {
  readonly allow: boolean;
  readonly reason?: string;
}

export class WriteDeniedError extends Error {
  readonly code = "WRITE_DENIED" as const;
}

export interface WatchSymbolOptions {
  readonly mode?: PlcWatchMode;
  readonly cycleTimeMs?: number;
  readonly maxDelayMs?: number;
}

export interface TwinCatAdsService {
  readonly state: AdsConnectionState;
  readonly writeMode: PlcWriteMode;
  readonly lastError: Error | undefined;
  readonly hasActiveConnection: boolean;

  connect(): Promise<AdsClientConnection>;
  disconnect(): Promise<void>;
  listSymbols(filter?: string): Promise<PlcSymbolSummary[]>;
  readSymbol<T = unknown>(name: string): Promise<PlcReadResult<T>>;
  readMany(names: readonly string[]): Promise<PlcReadResult[]>;
  writeSymbol<T = unknown>(
    name: string,
    value: T,
  ): Promise<PlcWriteResult<T>>;
  watchSymbol(
    name: string,
    options?: WatchSymbolOptions,
  ): Promise<PlcWatchRegistration>;
  unwatchSymbol(name: string): Promise<PlcWatchSnapshot>;
  listWatches(): PlcWatchSnapshot[];
  readState(): Promise<PlcStateResult>;
  setWriteMode(mode: PlcWriteMode): PlcWriteModeResult;
  getWriteModeState(): PlcWriteModeResult;
  canWrite(symbolName: string): PlcWriteAccessResult;
}

interface PlcWatchEntry {
  subscription: ActiveSubscription<unknown>;
  cycleTimeMs: number;
  mode: PlcWatchMode;
  callback?: SubscriptionCallback<unknown>;
  maxDelayMs?: number;
  lastValue?: unknown;
  lastTimestamp?: string;
}

function toAdsClientSettings(
  config: ExtensionRuntimeConfig,
): AdsClientSettings {
  if (config.connectionMode === "direct") {
    return {
      targetAmsNetId: config.targetAmsNetId,
      targetAdsPort: config.targetAdsPort,
      routerAddress: config.routerAddress,
      routerTcpPort: config.routerTcpPort,
      localAmsNetId: config.localAmsNetId,
      localAdsPort: config.localAdsPort,
      autoReconnect: true,
    };
  }

  return {
    targetAmsNetId: config.targetAmsNetId,
    targetAdsPort: config.targetAdsPort,
    autoReconnect: true,
  };
}

function toSymbolSummary(name: string, symbol: AdsSymbol): PlcSymbolSummary {
  return {
    name,
    type: symbol.type,
    size: symbol.size,
    comment: symbol.comment ?? "",
    flags: symbol.flags,
    indexGroup: symbol.indexGroup,
    indexOffset: symbol.indexOffset,
  };
}

function toReadResult<T>(result: ReadValueResult<T>): PlcReadResult<T> {
  return {
    name: result.symbol.name,
    value: result.value,
    type: result.dataType.name,
    timestamp: new Date().toISOString(),
    symbol: result.symbol,
  };
}

function toRawReadCommand(symbol: AdsSymbol): ReadRawMultiCommand {
  return {
    indexGroup: symbol.indexGroup,
    indexOffset: symbol.indexOffset,
    size: symbol.size,
  };
}

export class AdsService {
  readonly #client: Client;
  readonly #symbolCache = new Map<string, AdsSymbol>();
  readonly #symbolLookupCache = new Map<string, AdsSymbol>();
  readonly #handleCache = new Map<string, VariableHandle>();
  readonly #watchCache = new Map<string, PlcWatchEntry>();

  #state: AdsConnectionState = "disconnected";
  #lastError: Error | undefined;
  #connectPromise: Promise<AdsClientConnection> | undefined;
  #symbolsLoaded = false;
  #writeMode: PlcWriteMode = "read-only";

  constructor(
    private readonly config: ExtensionRuntimeConfig,
    private readonly dependencies: AdsServiceDependencies = {},
  ) {
    this.#client = new Client(toAdsClientSettings(config));
    this.#bindClientEvents();
  }

  get client(): Client {
    return this.#client;
  }

  get state(): AdsConnectionState {
    return this.#state;
  }

  get lastError(): Error | undefined {
    return this.#lastError;
  }

  get hasActiveConnection(): boolean {
    return this.#client.connection.connected;
  }

  get writeMode(): PlcWriteMode {
    return this.#writeMode;
  }

  async connect(): Promise<AdsClientConnection> {
    if (this.#client.connection.connected) {
      return this.#client.connection;
    }

    if (this.#connectPromise) {
      return this.#connectPromise;
    }

    this.#state = "connecting";
    this.#connectPromise = (async () => {
      try {
        const connection = await this.#client.connect();

        await this.#client.cacheSymbols();
        await this.#client.cacheDataTypes();
        await this.#loadSymbolCache();

        this.#state = "connected";
        this.#lastError = undefined;
        return connection;
      } catch (error) {
        this.#state = "degraded";
        this.#lastError =
          error instanceof Error ? error : new Error(String(error));
        throw error;
      } finally {
        this.#connectPromise = undefined;
      }
    })();

    return this.#connectPromise;
  }

  async disconnect(): Promise<void> {
    const watchEntries = [...this.#watchCache.values()];
    const cleanupErrors: Error[] = [];

    for (const watch of watchEntries) {
      try {
        await this.#client.unsubscribe(watch.subscription);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    for (const handle of this.#handleCache.values()) {
      try {
        await this.#client.deleteVariableHandle(handle);
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    this.#watchCache.clear();
    this.#handleCache.clear();
    this.#symbolCache.clear();
    this.#symbolsLoaded = false;

    if (this.#client.connection.connected) {
      try {
        await this.#client.disconnect();
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    this.#state = "disconnected";

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "ADS cleanup failed.");
    }
  }

  async listSymbols(filter?: string): Promise<PlcSymbolSummary[]> {
    await this.connect();
    await this.#ensureSymbolsLoaded();

    const normalizedFilter = filter?.trim().toLowerCase();

    return [...this.#symbolCache.entries()]
      .filter(([name, symbol]) => {
        if (!normalizedFilter) {
          return true;
        }

        return (
          name.toLowerCase().includes(normalizedFilter) ||
          symbol.type.toLowerCase().includes(normalizedFilter) ||
          (symbol.comment ?? "").toLowerCase().includes(normalizedFilter)
        );
      })
      .map(([name, symbol]) => toSymbolSummary(name, symbol))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async readValue<T = unknown>(name: string): Promise<PlcReadResult<T>> {
    await this.connect();
    const result = await this.#client.readValue<T>(name);
    return toReadResult(result);
  }

  async readSymbol<T = unknown>(name: string): Promise<PlcReadResult<T>> {
    return this.readValue(name);
  }

  async readMany(names: readonly string[]): Promise<PlcReadResult[]> {
    await this.connect();
    await this.#ensureSymbolsLoaded();

    const symbolResults = await Promise.all(
      names.map(async (name) => {
        try {
          return await this.getSymbol(name);
        } catch {
          return undefined;
        }
      }),
    );

    if (symbolResults.some((symbol) => symbol === undefined)) {
      return Promise.all(
        names.map(async (name) => {
          const result = await this.#client.readValue(name);
          return toReadResult(result);
        }),
      );
    }

    const symbols = symbolResults as AdsSymbol[];
    const commands = symbols.map((symbol) => toRawReadCommand(symbol));
    const rawResults = await this.#client.readRawMulti(commands);
    const timestamp = new Date().toISOString();

    return Promise.all(
      rawResults.map(async (result, index) => {
        const symbol = symbols[index];
        if (!symbol) {
          throw new Error(
            `Internal symbol mapping failed for PLC read at index ${index}.`,
          );
        }

        if (!result.success || !result.value) {
          throw new Error(`Failed to read PLC symbol "${symbol.name}".`);
        }

        const value = await this.#client.convertFromRaw(
          result.value,
          symbol.type as string | AdsDataType,
        );

        return {
          name: symbol.name,
          value,
          type: symbol.type,
          timestamp,
          symbol,
        };
      }),
    );
  }

  async writeValue<T = unknown>(
    name: string,
    value: T,
  ): Promise<WriteValueResult<T>> {
    await this.connect();
    this.#assertWriteAllowed(name);
    return this.#client.writeValue(name, value);
  }

  async writeSymbol<T = unknown>(
    name: string,
    value: T,
  ): Promise<PlcWriteResult<T>> {
    const result = await this.writeValue(name, value);
    return {
      name: result.symbol.name,
      value: result.value,
      type: result.dataType.name,
      timestamp: new Date().toISOString(),
    };
  }

  setWriteMode(mode: PlcWriteMode): PlcWriteModeResult {
    if (mode === "enabled" && this.config.readOnly) {
      throw new WriteDeniedError(
        "Writes cannot be enabled while config.readOnly is true.",
      );
    }

    this.#writeMode = mode;
    return this.#buildWriteModeResult();
  }

  getWriteModeState(): PlcWriteModeResult {
    return this.#buildWriteModeResult();
  }

  evaluateWriteAccess(symbolName: string): PlcWriteAccessResult {
    try {
      this.#assertWriteAllowed(symbolName);
      return {
        allow: true,
      };
    } catch (error) {
      return {
        allow: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  canWrite(symbolName: string): PlcWriteAccessResult {
    return this.evaluateWriteAccess(symbolName);
  }

  async readState(): Promise<PlcStateResult> {
    await this.connect();

    const [plcRuntimeState, tcSystemState, tcSystemExtendedState, deviceInfo] =
      await Promise.all([
        this.#client.readPlcRuntimeState(),
        this.#client.readTcSystemState(),
        this.#client.readTcSystemExtendedState(),
        this.#client.readDeviceInfo(),
      ]);

    return {
      connection: this.#client.connection,
      adsState: this.#state,
      writeMode: this.#writeMode,
      watchCount: this.#watchCache.size,
      writePolicy: {
        configReadOnly: this.config.readOnly,
        runtimeWriteEnabled: this.#writeMode === "enabled",
        allowlistCount: this.config.writeAllowlist.length,
      },
      plcRuntimeState,
      tcSystemState,
      tcSystemExtendedState,
      deviceInfo,
    };
  }

  async watchValue(
    name: string,
    callback?: SubscriptionCallback<unknown>,
    options?: {
      readonly cycleTimeMs?: number;
      readonly mode?: PlcWatchMode;
      readonly maxDelayMs?: number;
    },
  ): Promise<PlcWatchRegistration> {
    await this.connect();

    const existing = this.#watchCache.get(name);
    if (existing) {
      return this.#toWatchRegistration(name, existing);
    }

    if (this.#watchCache.size >= this.config.maxNotifications) {
      throw new Error(
        `Notification limit reached (${this.config.maxNotifications}).`,
      );
    }

    const cycleTimeMs =
      options?.cycleTimeMs ?? this.config.notificationCycleTimeMs;
    const mode = options?.mode ?? "on-change";

    const entry = {
      cycleTimeMs,
      mode,
    } as PlcWatchEntry;

    if (callback !== undefined) {
      entry.callback = callback;
    }

    if (options?.maxDelayMs !== undefined) {
      entry.maxDelayMs = options.maxDelayMs;
    }

    this.#watchCache.set(name, entry);
    entry.subscription = await this.#subscribeWatch(name, entry);

    if (entry.subscription.latestData) {
      entry.lastValue = entry.subscription.latestData.value;
      entry.lastTimestamp = entry.subscription.latestData.timestamp.toISOString();
    }

    return this.#toWatchRegistration(name, entry);
  }

  async watchSymbol(
    name: string,
    options?: WatchSymbolOptions,
  ): Promise<PlcWatchRegistration> {
    return this.watchValue(name, undefined, options);
  }

  async unwatchValue(name: string): Promise<PlcWatchSnapshot> {
    const entry = this.#watchCache.get(name);
    if (!entry) {
      return {
        name,
        notificationHandle: 0,
        cycleTimeMs: this.config.notificationCycleTimeMs,
        mode: "on-change",
        active: false,
      };
    }

    const snapshot = this.#toWatchSnapshot(name, entry);
    await this.#client.unsubscribe(entry.subscription);
    this.#watchCache.delete(name);

    return {
      ...snapshot,
      active: false,
    };
  }

  async unwatchSymbol(name: string): Promise<PlcWatchSnapshot> {
    return this.unwatchValue(name);
  }

  listWatches(): PlcWatchSnapshot[] {
    return [...this.#watchCache.entries()]
      .map(([name, entry]) => this.#toWatchSnapshot(name, entry))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getOrCreateHandle(name: string): Promise<VariableHandle> {
    await this.connect();

    const cached = this.#handleCache.get(name);
    if (cached) {
      return cached;
    }

    const handle = await this.#client.createVariableHandle(name);
    this.#handleCache.set(name, handle);
    return handle;
  }

  async getSymbol(name: string): Promise<AdsSymbol> {
    await this.connect();
    await this.#ensureSymbolsLoaded();

    const cached = this.#getCachedSymbol(name);
    if (cached) {
      return cached;
    }

    throw new Error(`PLC symbol "${name}" was not found.`);
  }

  async releaseHandle(name: string): Promise<void> {
    const handle = this.#handleCache.get(name);
    if (!handle) {
      return;
    }

    await this.#client.deleteVariableHandle(handle);
    this.#handleCache.delete(name);
  }

  #bindClientEvents(): void {
    this.#client.on("connect", () => {
      this.#state = "connected";
      this.dependencies.logger?.info?.("ADS client connected.");
    });

    this.#client.on("disconnect", () => {
      this.#state = "disconnected";
      this.dependencies.logger?.info?.("ADS client disconnected.");
    });

    this.#client.on("connectionLost", () => {
      this.#state = "degraded";
      this.#invalidateRuntimeCaches();
      this.dependencies.logger?.warn?.("ADS client connection lost.");
    });

    this.#client.on("reconnect", () => {
      this.#state = "connected";
      this.#invalidateRuntimeCaches();
      void this.#refreshRuntimeStateAfterReconnect();
      this.dependencies.logger?.info?.("ADS client reconnected.");
    });

    this.#client.on("plcSymbolVersionChange", () => {
      this.#invalidateRuntimeCaches();
      void this.#refreshRuntimeStateAfterReconnect();
    });

    this.#client.on("client-error", (error) => {
      this.#lastError = error;
      this.dependencies.logger?.error?.("ADS client error.", error);
    });
  }

  async #ensureSymbolsLoaded(): Promise<void> {
    if (this.#symbolsLoaded) {
      return;
    }

    await this.#loadSymbolCache();
  }

  async #loadSymbolCache(): Promise<void> {
    const symbols = await this.#client.getSymbols();
    this.#symbolCache.clear();
    this.#symbolLookupCache.clear();

    for (const [name, symbol] of Object.entries(symbols)) {
      this.#symbolCache.set(name, symbol);
      this.#symbolLookupCache.set(name.trim().toLowerCase(), symbol);
    }

    this.#symbolsLoaded = true;
  }

  #invalidateRuntimeCaches(): void {
    this.#symbolCache.clear();
    this.#symbolLookupCache.clear();
    this.#handleCache.clear();
    this.#symbolsLoaded = false;
  }

  #getCachedSymbol(name: string): AdsSymbol | undefined {
    const trimmedName = name.trim();

    return (
      this.#symbolCache.get(trimmedName) ??
      this.#symbolLookupCache.get(trimmedName.toLowerCase())
    );
  }

  #assertWriteAllowed(symbolName: string): void {
    if (this.config.readOnly) {
      throw new WriteDeniedError(
        "PLC writes are disabled by configuration because readOnly is true.",
      );
    }

    if (this.#writeMode !== "enabled") {
      throw new WriteDeniedError(
        "PLC writes are blocked by the runtime write gate. Enable writes explicitly before calling plc_write.",
      );
    }

    if (this.config.writeAllowlist.length === 0) {
      throw new WriteDeniedError(
        "PLC write denied because the configured writeAllowlist is empty, so no writes are currently permitted.",
      );
    }

    if (!isWriteAllowed(this.config, symbolName)) {
      throw new WriteDeniedError(
        `PLC write denied because "${symbolName}" is not in the configured writeAllowlist.`,
      );
    }
  }

  async #refreshRuntimeStateAfterReconnect(): Promise<void> {
    if (!this.#client.connection.connected) {
      return;
    }

    try {
      await this.#client.cacheSymbols();
      await this.#client.cacheDataTypes();
      await this.#loadSymbolCache();
      await this.#rebindWatchSubscriptions();
    } catch (error) {
      this.#lastError = error instanceof Error ? error : new Error(String(error));
      this.dependencies.logger?.warn?.(
        "ADS runtime refresh after reconnect failed.",
      );
    }
  }

  async #rebindWatchSubscriptions(): Promise<void> {
    const restoredSubscriptions = this.#collectActiveSubscriptionsByTarget();

    for (const [name, entry] of this.#watchCache.entries()) {
      const restored = restoredSubscriptions.get(name);

      if (restored) {
        entry.subscription = restored;

        if (restored.latestData) {
          entry.lastValue = restored.latestData.value;
          entry.lastTimestamp = restored.latestData.timestamp.toISOString();
        }

        continue;
      }

      entry.subscription = await this.#subscribeWatch(name, entry);
    }
  }

  #collectActiveSubscriptionsByTarget(): Map<string, ActiveSubscription<unknown>> {
    const subscriptions = new Map<string, ActiveSubscription<unknown>>();

    for (const targetContainer of Object.values(this.#client.activeSubscriptions)) {
      for (const subscription of Object.values(targetContainer)) {
        const target = subscription.settings.target;

        if (typeof target === "string") {
          subscriptions.set(target, subscription as ActiveSubscription<unknown>);
        }
      }
    }

    return subscriptions;
  }

  async #subscribeWatch(
    name: string,
    entry: Pick<PlcWatchEntry, "callback" | "cycleTimeMs" | "mode" | "maxDelayMs">,
  ): Promise<ActiveSubscription<unknown>> {
    const subscription = await this.#client.subscribeValue(
      name,
      this.#createWrappedWatchCallback(name, entry.callback),
      entry.cycleTimeMs,
      entry.mode === "on-change",
      entry.maxDelayMs,
    );

    if (subscription.latestData) {
      const watchEntry = this.#watchCache.get(name);
      if (watchEntry) {
        watchEntry.lastValue = subscription.latestData.value;
        watchEntry.lastTimestamp = subscription.latestData.timestamp.toISOString();
      }
    }

    return subscription;
  }

  #createWrappedWatchCallback(
    name: string,
    callback?: SubscriptionCallback<unknown>,
  ): SubscriptionCallback<unknown> {
    return (data: SubscriptionData<unknown>, subscription: ActiveSubscription<unknown>) => {
      const entry = this.#watchCache.get(name);
      if (entry) {
        entry.lastValue = data.value;
        entry.lastTimestamp = data.timestamp.toISOString();
      }

      callback?.(data, subscription);
    };
  }

  #toWatchRegistration(
    name: string,
    entry: PlcWatchEntry,
  ): PlcWatchRegistration {
    const snapshot = this.#toWatchSnapshot(name, entry);

    return {
      ...snapshot,
      unsubscribe: async () => {
        await this.unwatchValue(name);
      },
    };
  }

  #toWatchSnapshot(name: string, entry: PlcWatchEntry): PlcWatchSnapshot {
    const snapshot: {
      name: string;
      notificationHandle: number;
      cycleTimeMs: number;
      mode: PlcWatchMode;
      active: boolean;
      lastValue?: unknown;
      lastTimestamp?: string;
    } = {
      name,
      notificationHandle: entry.subscription.notificationHandle,
      cycleTimeMs: entry.cycleTimeMs,
      mode: entry.mode,
      active: true,
    };

    if (entry.lastValue !== undefined) {
      snapshot.lastValue = entry.lastValue;
    }

    if (entry.lastTimestamp !== undefined) {
      snapshot.lastTimestamp = entry.lastTimestamp;
    }

    return snapshot;
  }

  #buildWriteModeResult(): PlcWriteModeResult {
    return {
      writeMode: this.#writeMode,
      runtimeWriteEnabled: this.#writeMode === "enabled",
      configReadOnly: this.config.readOnly,
      writesAllowed: !this.config.readOnly && this.#writeMode === "enabled",
      message:
        this.#writeMode === "enabled"
          ? "PLC writes are enabled for this session."
          : "PLC writes are blocked for this session.",
    };
  }
}

export { ADS };
