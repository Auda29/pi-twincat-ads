import {
  ADS,
  Client,
  type ActiveSubscription,
  type AdsClientConnection,
  type AdsClientSettings,
  type AdsDataType,
  type AdsDeviceInfo,
  type AdsState,
  type AdsSymbol,
  type AdsTcSystemExtendedState,
  type ReadRawMultiCommand,
  type ReadValueResult,
  type SubscriptionCallback,
  type VariableHandle,
  type WriteValueResult,
} from "ads-client";

import type { ExtensionRuntimeConfig } from "../config.js";

export interface AdsServiceDependencies {
  readonly logger?: Pick<Console, "debug" | "error" | "info" | "warn">;
}

export type AdsConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded";

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

export interface PlcStateResult {
  readonly connection: AdsClientConnection;
  readonly adsState: AdsConnectionState;
  readonly plcRuntimeState: AdsState;
  readonly tcSystemState: AdsState;
  readonly tcSystemExtendedState: AdsTcSystemExtendedState;
  readonly deviceInfo: AdsDeviceInfo;
}

export interface PlcWatchRegistration {
  readonly name: string;
  readonly notificationHandle: number;
  readonly cycleTimeMs: number;
  readonly mode: "on-change" | "cyclic";
  unsubscribe(): Promise<void>;
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
  readonly #handleCache = new Map<string, VariableHandle>();
  readonly #watchCache = new Map<string, ActiveSubscription>();

  #state: AdsConnectionState = "disconnected";
  #lastError: Error | undefined;
  #connectPromise: Promise<AdsClientConnection> | undefined;
  #symbolsLoaded = false;

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
        await this.#client.unsubscribe(watch);
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

  async readMany(names: string[]): Promise<PlcReadResult[]> {
    await this.connect();
    await this.#ensureSymbolsLoaded();

    const symbols = await Promise.all(names.map((name) => this.getSymbol(name)));
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
    return this.#client.writeValue(name, value);
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
      plcRuntimeState,
      tcSystemState,
      tcSystemExtendedState,
      deviceInfo,
    };
  }

  async watchValue<T = unknown>(
    name: string,
    callback: SubscriptionCallback<T>,
    options?: {
      readonly cycleTimeMs?: number;
      readonly mode?: "on-change" | "cyclic";
      readonly maxDelayMs?: number;
    },
  ): Promise<PlcWatchRegistration> {
    await this.connect();

    if (this.#watchCache.size >= this.config.maxNotifications) {
      throw new Error(
        `Notification limit reached (${this.config.maxNotifications}).`,
      );
    }

    const cycleTimeMs =
      options?.cycleTimeMs ?? this.config.notificationCycleTimeMs;
    const mode = options?.mode ?? "on-change";

    const subscription = await this.#client.subscribeValue<T>(
      name,
      callback,
      cycleTimeMs,
      mode === "on-change",
      options?.maxDelayMs,
    );

    this.#watchCache.set(name, subscription);

    return {
      name,
      notificationHandle: subscription.notificationHandle,
      cycleTimeMs,
      mode,
      unsubscribe: async () => {
        await subscription.unsubscribe();
        this.#watchCache.delete(name);
      },
    };
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

    const cached = this.#symbolCache.get(name);
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
      void this.#refreshCachesAfterReconnect();
      this.dependencies.logger?.info?.("ADS client reconnected.");
    });

    this.#client.on("plcSymbolVersionChange", () => {
      this.#invalidateRuntimeCaches();
      void this.#refreshCachesAfterReconnect();
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

    for (const [name, symbol] of Object.entries(symbols)) {
      this.#symbolCache.set(name, symbol);
    }

    this.#symbolsLoaded = true;
  }

  #invalidateRuntimeCaches(): void {
    this.#symbolCache.clear();
    this.#handleCache.clear();
    this.#symbolsLoaded = false;
  }

  async #refreshCachesAfterReconnect(): Promise<void> {
    if (!this.#client.connection.connected) {
      return;
    }

    try {
      await this.#client.cacheSymbols();
      await this.#client.cacheDataTypes();
      await this.#loadSymbolCache();
    } catch (error) {
      this.#lastError = error instanceof Error ? error : new Error(String(error));
      this.dependencies.logger?.warn?.(
        "ADS cache refresh after reconnect failed.",
      );
    }
  }
}

export { ADS };
