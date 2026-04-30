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
  DEFAULT_IO_ADS_PORT,
  DEFAULT_MAX_WAIT_UNTIL_MS,
  DEFAULT_NC_ADS_PORT,
  isWriteAllowed,
  type ExtensionRuntimeConfig,
  type TwinCatAdsServiceName,
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

export interface AdsNamedServiceConnectionSummary {
  readonly name: TwinCatAdsServiceName;
  readonly targetAdsPort: number;
  readonly connected: boolean;
  readonly state: AdsConnectionState;
}

export interface PlcSymbolSummary {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly comment: string;
  readonly flags: number;
  readonly indexGroup: number;
  readonly indexOffset: number;
}

export interface PlcDataTypeMemberDescription {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly offset: number;
  readonly comment: string;
  readonly arrayDimension: number;
  readonly arrayInfos: AdsDataType["arrayInfos"];
  readonly attributes: AdsDataType["attributes"];
  readonly subItems?: PlcDataTypeMemberDescription[];
}

export interface PlcSymbolDescription extends PlcSymbolSummary {
  readonly adsDataType?: number;
  readonly adsDataTypeStr?: string;
  readonly flagsStr?: string[];
  readonly arrayDimension?: number;
  readonly arrayInfo?: AdsSymbol["arrayInfo"];
  readonly attributes?: AdsSymbol["attributes"];
  readonly typeGuid?: string;
  readonly dataType?: PlcDataTypeMemberDescription;
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

export interface AdsStateSummary {
  readonly adsState: number;
  readonly adsStateName: string;
  readonly deviceState: number;
  readonly isRun: boolean;
  readonly isStop: boolean;
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
  readonly plcRuntimeStatus: AdsStateSummary;
  readonly tcSystemState: AdsState;
  readonly tcSystemStatus: AdsStateSummary;
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

export interface PlcSymbolGroupSummary {
  readonly name: string;
  readonly symbols: string[];
  readonly count: number;
}

export interface PlcReadGroupResult {
  readonly group: string;
  readonly symbols: string[];
  readonly results: PlcReadResult[];
  readonly count: number;
}

export type PlcWaitComparisonOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEquals"
  | "lessThan"
  | "lessThanOrEquals";

export interface PlcWaitComparisonCondition {
  readonly name: string;
  readonly operator: PlcWaitComparisonOperator;
  readonly value?: unknown;
}

export interface PlcWaitAllOfCondition {
  readonly allOf: readonly PlcWaitCondition[];
}

export interface PlcWaitAnyOfCondition {
  readonly anyOf: readonly PlcWaitCondition[];
}

export type PlcWaitCondition =
  | PlcWaitComparisonCondition
  | PlcWaitAllOfCondition
  | PlcWaitAnyOfCondition;

export interface PlcWaitUntilInput {
  readonly condition: PlcWaitCondition;
  readonly timeoutMs: number;
  readonly stableForMs?: number;
  readonly cycleTimeMs?: number;
  readonly maxDelayMs?: number;
  readonly signal?: AbortSignal;
}

export type PlcWaitUntilStatus = "fulfilled" | "timeout" | "cancelled";

export interface PlcWaitValueSnapshot {
  readonly name: string;
  readonly value: unknown;
  readonly timestamp: string;
}

export interface PlcWaitUntilResult {
  readonly status: PlcWaitUntilStatus;
  readonly conditionMatched: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly timeoutMs: number;
  readonly stableForMs: number;
  readonly values: PlcWaitValueSnapshot[];
}

const ADS_STATE_RUN = 5;
const ADS_STATE_STOP = 6;
const ADS_STATE_NAMES = new Map<number, string>([
  [0, "Invalid"],
  [1, "Idle"],
  [2, "Reset"],
  [3, "Initialize"],
  [4, "Start"],
  [ADS_STATE_RUN, "Run"],
  [ADS_STATE_STOP, "Stop"],
  [7, "SaveConfig"],
  [8, "LoadConfig"],
  [9, "PowerFailure"],
  [10, "PowerGood"],
  [11, "Error"],
  [12, "Shutdown"],
  [13, "Suspend"],
  [14, "Resume"],
  [15, "Config"],
  [16, "Reconfig"],
  [17, "Stopping"],
  [18, "Incompatible"],
  [19, "Exception"],
]);

export class WriteDeniedError extends Error {
  readonly code = "WRITE_DENIED" as const;
}

function summarizeAdsState(state: AdsState): AdsStateSummary {
  const adsStateName =
    state.adsStateStr ??
    ADS_STATE_NAMES.get(state.adsState) ??
    `Unknown(${state.adsState})`;

  return {
    adsState: state.adsState,
    adsStateName,
    deviceState: state.deviceState,
    isRun: state.adsState === ADS_STATE_RUN,
    isStop: state.adsState === ADS_STATE_STOP,
  };
}

export interface WatchSymbolOptions {
  readonly mode?: PlcWatchMode;
  readonly cycleTimeMs?: number;
  readonly maxDelayMs?: number;
}

function collectConditionSymbols(
  condition: PlcWaitCondition,
  symbols = new Set<string>(),
): Set<string> {
  if ("name" in condition) {
    symbols.add(condition.name.trim());
    return symbols;
  }

  if ("allOf" in condition) {
    for (const child of condition.allOf) {
      collectConditionSymbols(child, symbols);
    }
    return symbols;
  }

  for (const child of condition.anyOf) {
    collectConditionSymbols(child, symbols);
  }

  return symbols;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function compareNumbers(
  left: unknown,
  right: unknown,
  operator: Exclude<PlcWaitComparisonOperator, "equals" | "notEquals">,
): boolean {
  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);

  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return false;
  }

  switch (operator) {
    case "greaterThan":
      return leftNumber > rightNumber;
    case "greaterThanOrEquals":
      return leftNumber >= rightNumber;
    case "lessThan":
      return leftNumber < rightNumber;
    case "lessThanOrEquals":
      return leftNumber <= rightNumber;
  }
}

function evaluateCondition(
  condition: PlcWaitCondition,
  values: ReadonlyMap<string, PlcWaitValueSnapshot>,
): boolean {
  if ("allOf" in condition) {
    return condition.allOf.every((child) => evaluateCondition(child, values));
  }

  if ("anyOf" in condition) {
    return condition.anyOf.some((child) => evaluateCondition(child, values));
  }

  const snapshot = values.get(condition.name.trim());
  if (snapshot === undefined) {
    return false;
  }

  switch (condition.operator) {
    case "equals":
      return valuesEqual(snapshot.value, condition.value);
    case "notEquals":
      return !valuesEqual(snapshot.value, condition.value);
    default:
      return compareNumbers(snapshot.value, condition.value, condition.operator);
  }
}

export interface TwinCatAdsService {
  readonly state: AdsConnectionState;
  readonly writeMode: PlcWriteMode;
  readonly lastError: Error | undefined;
  readonly hasActiveConnection: boolean;

  listServices(): AdsNamedServiceConnectionSummary[];
  getServiceClient(name: TwinCatAdsServiceName): Client;
  connectService(name: TwinCatAdsServiceName): Promise<AdsClientConnection>;
  disconnectService(name: TwinCatAdsServiceName): Promise<void>;
  connect(): Promise<AdsClientConnection>;
  disconnect(): Promise<void>;
  listSymbols(filter?: string): Promise<PlcSymbolSummary[]>;
  describeSymbol(name: string): Promise<PlcSymbolDescription>;
  readSymbol<T = unknown>(name: string): Promise<PlcReadResult<T>>;
  readMany(names: readonly string[]): Promise<PlcReadResult[]>;
  listGroups(): PlcSymbolGroupSummary[];
  readGroup(group: string): Promise<PlcReadGroupResult>;
  writeSymbol<T = unknown>(
    name: string,
    value: T,
  ): Promise<PlcWriteResult<T>>;
  waitUntil(input: PlcWaitUntilInput): Promise<PlcWaitUntilResult>;
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

type AdsServiceRuntimeConfigInput = Omit<
  ExtensionRuntimeConfig,
  "maxWaitUntilMs" | "services"
> & {
  readonly maxWaitUntilMs?: number;
  readonly services?: Partial<ExtensionRuntimeConfig["services"]>;
};

function completeRuntimeConfig(
  config: AdsServiceRuntimeConfigInput,
): ExtensionRuntimeConfig {
  const plcTargetAdsPort =
    config.services?.plc?.targetAdsPort ?? config.targetAdsPort;

  return {
    ...config,
    targetAdsPort: plcTargetAdsPort,
    maxWaitUntilMs: config.maxWaitUntilMs ?? DEFAULT_MAX_WAIT_UNTIL_MS,
    services: {
      plc: {
        targetAdsPort: plcTargetAdsPort,
        symbolGroups: config.services?.plc?.symbolGroups ?? {},
      },
      nc: {
        targetAdsPort:
          config.services?.nc?.targetAdsPort ?? DEFAULT_NC_ADS_PORT,
      },
      io: {
        targetAdsPort:
          config.services?.io?.targetAdsPort ?? DEFAULT_IO_ADS_PORT,
      },
    },
  };
}

function toAdsClientSettings(
  config: ExtensionRuntimeConfig,
  targetAdsPort = config.targetAdsPort,
): AdsClientSettings {
  if (config.connectionMode === "direct") {
    const settings: AdsClientSettings = {
      targetAmsNetId: config.targetAmsNetId,
      targetAdsPort,
      autoReconnect: true,
    };

    if (config.routerAddress !== undefined) {
      settings.routerAddress = config.routerAddress;
    }

    if (config.routerTcpPort !== undefined) {
      settings.routerTcpPort = config.routerTcpPort;
    }

    if (config.localAmsNetId !== undefined) {
      settings.localAmsNetId = config.localAmsNetId;
    }

    if (config.localAdsPort !== undefined) {
      settings.localAdsPort = config.localAdsPort;
    }

    return settings;
  }

  return {
    targetAmsNetId: config.targetAmsNetId,
    targetAdsPort,
    autoReconnect: true,
  };
}

function createServiceClients(
  config: ExtensionRuntimeConfig,
): Map<TwinCatAdsServiceName, Client> {
  return new Map<TwinCatAdsServiceName, Client>([
    [
      "plc",
      new Client(toAdsClientSettings(config, config.services.plc.targetAdsPort)),
    ],
    [
      "nc",
      new Client(toAdsClientSettings(config, config.services.nc.targetAdsPort)),
    ],
    [
      "io",
      new Client(toAdsClientSettings(config, config.services.io.targetAdsPort)),
    ],
  ]);
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

function toDataTypeDescription(
  dataType: AdsDataType,
  depth = 0,
): PlcDataTypeMemberDescription {
  const description: {
    name: string;
    type: string;
    size: number;
    offset: number;
    comment: string;
    arrayDimension: number;
    arrayInfos: AdsDataType["arrayInfos"];
    attributes: AdsDataType["attributes"];
    subItems?: PlcDataTypeMemberDescription[];
  } = {
    name: dataType.name,
    type: dataType.type,
    size: dataType.size,
    offset: dataType.offset,
    comment: dataType.comment ?? "",
    arrayDimension: dataType.arrayDimension,
    arrayInfos: dataType.arrayInfos,
    attributes: dataType.attributes,
  };

  if (depth < 2 && dataType.subItems.length > 0) {
    description.subItems = dataType.subItems.map((subItem) =>
      toDataTypeDescription(subItem, depth + 1),
    );
  }

  return description;
}

function toSymbolDescription(
  name: string,
  symbol: AdsSymbol,
  dataType?: AdsDataType,
): PlcSymbolDescription {
  const description: {
    name: string;
    type: string;
    size: number;
    comment: string;
    flags: number;
    indexGroup: number;
    indexOffset: number;
    adsDataType?: number;
    adsDataTypeStr?: string;
    flagsStr?: string[];
    arrayDimension?: number;
    arrayInfo?: AdsSymbol["arrayInfo"];
    attributes?: AdsSymbol["attributes"];
    typeGuid?: string;
    dataType?: PlcDataTypeMemberDescription;
  } = {
    ...toSymbolSummary(name, symbol),
  };

  if (symbol.adsDataType !== undefined) {
    description.adsDataType = symbol.adsDataType;
  }

  if (symbol.adsDataTypeStr !== undefined) {
    description.adsDataTypeStr = symbol.adsDataTypeStr;
  }

  if (symbol.flagsStr !== undefined) {
    description.flagsStr = symbol.flagsStr;
  }

  if (symbol.arrayDimension !== undefined) {
    description.arrayDimension = symbol.arrayDimension;
  }

  if (symbol.arrayInfo !== undefined) {
    description.arrayInfo = symbol.arrayInfo;
  }

  if (symbol.attributes !== undefined) {
    description.attributes = symbol.attributes;
  }

  if (symbol.typeGuid !== undefined) {
    description.typeGuid = symbol.typeGuid;
  }

  if (dataType !== undefined) {
    description.dataType = toDataTypeDescription(dataType);
  }

  return description;
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
  readonly #serviceClients: Map<TwinCatAdsServiceName, Client>;
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
  private readonly config: ExtensionRuntimeConfig;

  constructor(
    config: AdsServiceRuntimeConfigInput,
    private readonly dependencies: AdsServiceDependencies = {},
  ) {
    this.config = completeRuntimeConfig(config);
    this.#serviceClients = createServiceClients(this.config);
    this.#client = this.#getExistingServiceClient("plc");
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

  listServices(): AdsNamedServiceConnectionSummary[] {
    return (["plc", "nc", "io"] as const).map((name) => {
      const client = this.#getExistingServiceClient(name);
      return {
        name,
        targetAdsPort: this.config.services[name].targetAdsPort,
        connected: client.connection.connected,
        state: name === "plc" ? this.#state : this.#serviceState(client),
      };
    });
  }

  getServiceClient(name: TwinCatAdsServiceName): Client {
    return this.#getExistingServiceClient(name);
  }

  async connectService(
    name: TwinCatAdsServiceName,
  ): Promise<AdsClientConnection> {
    if (name === "plc") {
      return this.connect();
    }

    const client = this.#getExistingServiceClient(name);
    if (client.connection.connected) {
      return client.connection;
    }

    return client.connect();
  }

  async disconnectService(name: TwinCatAdsServiceName): Promise<void> {
    if (name === "plc") {
      await this.disconnect();
      return;
    }

    const client = this.#getExistingServiceClient(name);
    if (client.connection.connected) {
      await client.disconnect();
    }
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

    for (const [name, client] of this.#serviceClients.entries()) {
      if (name === "plc" || !client.connection.connected) {
        continue;
      }

      try {
        await client.disconnect();
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

  async describeSymbol(name: string): Promise<PlcSymbolDescription> {
    await this.connect();
    const symbol = await this.getSymbol(name);

    try {
      const dataType = await this.#client.getDataType(symbol.type);
      return toSymbolDescription(symbol.name, symbol, dataType);
    } catch {
      return toSymbolDescription(symbol.name, symbol);
    }
  }

  listGroups(): PlcSymbolGroupSummary[] {
    return Object.entries(this.config.services.plc.symbolGroups)
      .map(([name, symbols]) => ({
        name,
        symbols: [...symbols],
        count: symbols.length,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async readGroup(group: string): Promise<PlcReadGroupResult> {
    const normalizedGroup = group.trim();
    const symbols = this.config.services.plc.symbolGroups[normalizedGroup];

    if (symbols === undefined) {
      throw new Error(`PLC symbol group "${normalizedGroup}" was not found.`);
    }

    const results = await this.readMany(symbols);
    return {
      group: normalizedGroup,
      symbols: [...symbols],
      results,
      count: results.length,
    };
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
      plcRuntimeStatus: summarizeAdsState(plcRuntimeState),
      tcSystemState,
      tcSystemStatus: summarizeAdsState(tcSystemState),
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

  async waitUntil(input: PlcWaitUntilInput): Promise<PlcWaitUntilResult> {
    if (input.timeoutMs > this.config.maxWaitUntilMs) {
      throw new Error(
        `PLC wait timeout ${input.timeoutMs} ms exceeds configured maximum ${this.config.maxWaitUntilMs} ms.`,
      );
    }

    const symbolNames = [...collectConditionSymbols(input.condition)];
    if (symbolNames.length === 0) {
      throw new Error("PLC wait condition must reference at least one symbol.");
    }

    await this.connect();

    const startedAtTime = Date.now();
    const startedAt = new Date(startedAtTime).toISOString();
    const stableForMs = input.stableForMs ?? 0;
    const cycleTimeMs = input.cycleTimeMs ?? this.config.notificationCycleTimeMs;
    const values = new Map<string, PlcWaitValueSnapshot>();
    const subscriptions: ActiveSubscription<unknown>[] = [];

    return new Promise<PlcWaitUntilResult>((resolve, reject) => {
      let settled = false;
      let stableSince: number | undefined;
      let stableTimer: ReturnType<typeof setTimeout> | undefined;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;

      const timeoutTimer = setTimeout(() => {
        finish("timeout");
      }, input.timeoutMs);

      const abortHandler = () => {
        finish("cancelled");
      };

      const cleanup = async (): Promise<void> => {
        clearTimeout(timeoutTimer);

        if (stableTimer !== undefined) {
          clearTimeout(stableTimer);
        }

        if (pollTimer !== undefined) {
          clearTimeout(pollTimer);
        }

        input.signal?.removeEventListener("abort", abortHandler);

        const cleanupErrors: Error[] = [];
        for (const subscription of subscriptions) {
          try {
            await this.#client.unsubscribe(subscription);
          } catch (error) {
            cleanupErrors.push(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }

        if (cleanupErrors.length > 0) {
          this.#lastError = new AggregateError(
            cleanupErrors,
            "PLC wait subscription cleanup failed.",
          );
        }
      };

      const snapshotValues = (): PlcWaitValueSnapshot[] =>
        symbolNames
          .map((name) => values.get(name))
          .filter((value): value is PlcWaitValueSnapshot => value !== undefined);

      const finish = (status: PlcWaitUntilStatus): void => {
        if (settled) {
          return;
        }

        settled = true;
        const completedAtTime = Date.now();
        void cleanup();
        resolve({
          status,
          conditionMatched: evaluateCondition(input.condition, values),
          startedAt,
          completedAt: new Date(completedAtTime).toISOString(),
          durationMs: completedAtTime - startedAtTime,
          timeoutMs: input.timeoutMs,
          stableForMs,
          values: snapshotValues(),
        });
      };

      const evaluate = (): void => {
        if (settled) {
          return;
        }

        const conditionMatched = evaluateCondition(input.condition, values);
        if (!conditionMatched) {
          stableSince = undefined;
          if (stableTimer !== undefined) {
            clearTimeout(stableTimer);
            stableTimer = undefined;
          }
          return;
        }

        if (stableForMs <= 0) {
          finish("fulfilled");
          return;
        }

        const now = Date.now();
        stableSince ??= now;
        const elapsedStableMs = now - stableSince;

        if (elapsedStableMs >= stableForMs) {
          finish("fulfilled");
          return;
        }

        if (stableTimer === undefined) {
          stableTimer = setTimeout(() => {
            stableTimer = undefined;
            evaluate();
          }, stableForMs - elapsedStableMs);
        }
      };

      const updateValue = (name: string, value: unknown, timestamp: Date): void => {
        values.set(name, {
          name,
          value,
          timestamp: timestamp.toISOString(),
        });
        evaluate();
      };

      const poll = async (): Promise<void> => {
        try {
          const results = await this.readMany(symbolNames);
          for (const result of results) {
            updateValue(result.name, result.value, new Date(result.timestamp));
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            void cleanup();
            reject(error);
          }
          return;
        }

        if (!settled) {
          pollTimer = setTimeout(() => {
            void poll();
          }, cycleTimeMs);
        }
      };

      const subscribe = async (): Promise<void> => {
        if (input.signal?.aborted) {
          finish("cancelled");
          return;
        }

        input.signal?.addEventListener("abort", abortHandler, { once: true });

        try {
          for (const name of symbolNames) {
            if (settled) {
              break;
            }

            const subscription = await this.#client.subscribeValue(
              name,
              (data) => updateValue(name, data.value, data.timestamp),
              cycleTimeMs,
              true,
              input.maxDelayMs,
            );

            if (settled) {
              await this.#client.unsubscribe(subscription);
              break;
            }

            subscriptions.push(subscription);
            if (subscription.latestData) {
              updateValue(
                name,
                subscription.latestData.value,
                subscription.latestData.timestamp,
              );
            }

            if (settled) {
              break;
            }
          }

          const missingNames = settled
            ? []
            : symbolNames.filter((name) => !values.has(name));
          if (missingNames.length > 0) {
            const initialValues = await this.readMany(missingNames);
            for (const result of initialValues) {
              updateValue(result.name, result.value, new Date(result.timestamp));
            }
          }
        } catch {
          for (const subscription of subscriptions.splice(0)) {
            try {
              await this.#client.unsubscribe(subscription);
            } catch {
              // Best effort cleanup before falling back to polling.
            }
          }

          await poll();
        }
      };

      void subscribe().catch((error) => {
        if (!settled) {
          settled = true;
          void cleanup();
          reject(error);
        }
      });
    });
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

  #getExistingServiceClient(name: TwinCatAdsServiceName): Client {
    const client = this.#serviceClients.get(name);
    if (client === undefined) {
      throw new Error(`ADS service "${name}" is not configured.`);
    }

    return client;
  }

  #serviceState(client: Client): AdsConnectionState {
    return client.connection.connected ? "connected" : "disconnected";
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
