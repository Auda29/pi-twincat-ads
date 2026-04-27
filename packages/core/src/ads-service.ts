export type AdsConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded";

export type PlcWriteMode = "read-only" | "enabled";
export type PlcWatchMode = "on-change" | "cyclic";

export interface AdsConnectionInfo {
  readonly connected: boolean;
  readonly targetAmsNetId?: string;
  readonly targetAdsPort?: number;
}

export interface AdsStateSnapshot {
  readonly adsState: string | number;
  readonly deviceState: number;
  readonly raw?: unknown;
}

export interface AdsDeviceInfo {
  readonly majorVersion?: number;
  readonly minorVersion?: number;
  readonly versionBuild?: number;
  readonly deviceName?: string;
  readonly raw?: unknown;
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

export interface PlcReadResult<T = unknown> {
  readonly name: string;
  readonly value: T;
  readonly type: string;
  readonly timestamp: string;
  readonly symbol: PlcSymbolSummary;
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
  readonly connection: AdsConnectionInfo;
  readonly adsState: AdsConnectionState;
  readonly writeMode: PlcWriteMode;
  readonly watchCount: number;
  readonly writePolicy: {
    readonly configReadOnly: boolean;
    readonly runtimeWriteEnabled: boolean;
    readonly allowlistCount: number;
  };
  readonly plcRuntimeState: AdsStateSnapshot;
  readonly tcSystemState: AdsStateSnapshot;
  readonly tcSystemExtendedState?: unknown;
  readonly deviceInfo: AdsDeviceInfo;
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
  readonly lastError?: Error;
  readonly hasActiveConnection: boolean;

  connect(): Promise<AdsConnectionInfo>;
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
  ): Promise<PlcWatchSnapshot>;
  unwatchSymbol(name: string): Promise<PlcWatchSnapshot>;
  listWatches(): PlcWatchSnapshot[];
  readState(): Promise<PlcStateResult>;
  setWriteMode(mode: PlcWriteMode): Promise<PlcWriteModeResult>;
  canWrite?(symbolName: string): PlcWriteAccessResult;
}
