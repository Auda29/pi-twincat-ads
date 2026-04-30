import type { TwinCatAdsRuntimeConfig } from "./config.js";
import type {
  AdsConnectionInfo,
  PlcWriteAccessResult,
  PlcReadResult,
  PlcReadGroupResult,
  PlcStateResult,
  PlcSymbolDescription,
  PlcSymbolGroupSummary,
  PlcSymbolSummary,
  PlcWatchMode,
  PlcWatchSnapshot,
  PlcWaitUntilInput,
  PlcWaitUntilResult,
  PlcWriteMode,
  PlcWriteModeResult,
  PlcWriteResult,
  TwinCatAdsService,
} from "./ads-service.js";

export interface ReadSymbolInput {
  readonly name: string;
}

export interface DescribeSymbolInput {
  readonly name: string;
}

export interface ReadManyInput {
  readonly names: readonly string[];
}

export interface ReadGroupInput {
  readonly group: string;
}

export interface WriteSymbolInput<T = unknown> {
  readonly name: string;
  readonly value: T;
}

export interface WatchSymbolInput {
  readonly name: string;
  readonly mode?: PlcWatchMode;
  readonly cycleTimeMs?: number;
  readonly maxDelayMs?: number;
}

export interface UnwatchSymbolInput {
  readonly name: string;
}

export interface ListSymbolsInput {
  readonly filter?: string;
}

export interface SetWriteModeInput {
  readonly mode: PlcWriteMode;
}

export interface TwinCatAdsOperations {
  connect(): Promise<AdsConnectionInfo>;
  disconnect(): Promise<void>;
  listSymbols(input?: ListSymbolsInput): Promise<PlcSymbolSummary[]>;
  describeSymbol(input: DescribeSymbolInput): Promise<PlcSymbolDescription>;
  readSymbol<T = unknown>(input: ReadSymbolInput): Promise<PlcReadResult<T>>;
  readMany(input: ReadManyInput): Promise<PlcReadResult[]>;
  listGroups(): PlcSymbolGroupSummary[];
  readGroup(input: ReadGroupInput): Promise<PlcReadGroupResult>;
  writeSymbol<T = unknown>(
    input: WriteSymbolInput<T>,
  ): Promise<PlcWriteResult<T>>;
  waitUntil(input: PlcWaitUntilInput): Promise<PlcWaitUntilResult>;
  watchSymbol(input: WatchSymbolInput): Promise<PlcWatchSnapshot>;
  unwatchSymbol(input: UnwatchSymbolInput): Promise<PlcWatchSnapshot>;
  listWatches(): PlcWatchSnapshot[];
  readState(): Promise<PlcStateResult>;
  setWriteMode(input: SetWriteModeInput): Promise<PlcWriteModeResult>;
  getWriteModeState(): PlcWriteModeResult;
  evaluateWriteAccess(symbolName: string): PlcWriteAccessResult;
}

export interface TwinCatAdsRuntime extends TwinCatAdsOperations {
  readonly service: TwinCatAdsService;
  readonly config?: TwinCatAdsRuntimeConfig;
}

export interface CreateTwinCatAdsRuntimeOptions {
  readonly config?: TwinCatAdsRuntimeConfig;
}

export function createTwinCatAdsRuntime(
  service: TwinCatAdsService,
  options: CreateTwinCatAdsRuntimeOptions = {},
): TwinCatAdsRuntime {
  const runtime: TwinCatAdsRuntime = {
    service,
    connect: async () => service.connect(),
    disconnect: async () => service.disconnect(),
    listSymbols: async (input = {}) => service.listSymbols(input.filter),
    describeSymbol: async (input) => service.describeSymbol(input.name),
    readSymbol: async (input) => service.readSymbol(input.name),
    readMany: async (input) => service.readMany(input.names),
    listGroups: () => service.listGroups(),
    readGroup: async (input) => service.readGroup(input.group),
    writeSymbol: async (input) => service.writeSymbol(input.name, input.value),
    waitUntil: async (input) => service.waitUntil(input),
    watchSymbol: async (input) => {
      const watchOptions: {
        mode?: PlcWatchMode;
        cycleTimeMs?: number;
        maxDelayMs?: number;
      } = {};

      if (input.mode !== undefined) {
        watchOptions.mode = input.mode;
      }

      if (input.cycleTimeMs !== undefined) {
        watchOptions.cycleTimeMs = input.cycleTimeMs;
      }

      if (input.maxDelayMs !== undefined) {
        watchOptions.maxDelayMs = input.maxDelayMs;
      }

      return service.watchSymbol(input.name, watchOptions);
    },
    unwatchSymbol: async (input) => service.unwatchSymbol(input.name),
    listWatches: () => service.listWatches(),
    readState: async () => service.readState(),
    setWriteMode: async (input) => service.setWriteMode(input.mode),
    getWriteModeState: () => service.getWriteModeState(),
    evaluateWriteAccess: (symbolName) =>
      service.canWrite?.(symbolName) ?? {
        allow: false,
        reason: "The configured ADS service does not expose write access evaluation.",
      },
  };

  if (options.config !== undefined) {
    return {
      ...runtime,
      config: options.config,
    };
  }

  return runtime;
}
