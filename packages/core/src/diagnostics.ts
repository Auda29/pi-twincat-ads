import { spawn } from "node:child_process";
import { open, stat } from "node:fs/promises";

import type {
  FileDiagnosticLogSourceConfig,
  RuntimeDiagnosticsConfig,
  RuntimeLogSourceConfig,
  WindowsEventLogDiagnosticSourceConfig,
} from "./config.js";

export type RuntimeDiagnosticSeverity =
  | "critical"
  | "error"
  | "warning"
  | "info"
  | "verbose"
  | "unknown";

export interface RuntimeDiagnosticSourceCapability {
  readonly id: string;
  readonly kind: string;
  readonly available: boolean;
  readonly reason?: string;
  readonly description?: string;
}

export interface RuntimeDiagnosticsCapabilities {
  readonly eventSources: RuntimeDiagnosticSourceCapability[];
  readonly logSources: RuntimeDiagnosticSourceCapability[];
}

export interface RuntimeEvent {
  readonly timestamp: string;
  readonly source: string;
  readonly severity: RuntimeDiagnosticSeverity;
  readonly id?: number | undefined;
  readonly message: string;
  readonly provider?: string | undefined;
  readonly logName?: string | undefined;
  readonly recordId?: number | undefined;
  readonly machineName?: string | undefined;
  readonly raw?: unknown;
}

export interface RuntimeEventQuery {
  readonly source?: string | undefined;
  readonly limit?: number | undefined;
  readonly since?: string | undefined;
  readonly until?: string | undefined;
  readonly severity?:
    | RuntimeDiagnosticSeverity
    | readonly RuntimeDiagnosticSeverity[]
    | undefined;
  readonly contains?: string | undefined;
  readonly id?: number | readonly number[] | undefined;
}

export interface NormalizedRuntimeEventQuery {
  readonly source?: string;
  readonly limit: number;
  readonly since?: string;
  readonly until?: string;
  readonly severity?: RuntimeDiagnosticSeverity[];
  readonly contains?: string;
  readonly ids?: number[];
}

export interface RuntimeEventListResult {
  readonly source: string | null;
  readonly available: boolean;
  readonly capability: RuntimeDiagnosticSourceCapability;
  readonly events: RuntimeEvent[];
  readonly count: number;
  readonly truncated: boolean;
  readonly query: NormalizedRuntimeEventQuery;
}

export interface RuntimeErrorListResult extends RuntimeEventListResult {
  readonly errors: RuntimeEvent[];
}

export interface RuntimeLogQuery {
  readonly source?: string | undefined;
  readonly limitBytes?: number | undefined;
  readonly tailLines?: number | undefined;
  readonly since?: string | undefined;
  readonly severity?:
    | RuntimeDiagnosticSeverity
    | readonly RuntimeDiagnosticSeverity[]
    | undefined;
  readonly contains?: string | undefined;
}

export interface NormalizedRuntimeLogQuery {
  readonly source?: string;
  readonly limitBytes: number;
  readonly tailLines?: number;
  readonly since?: string;
  readonly severity?: RuntimeDiagnosticSeverity[];
  readonly contains?: string;
}

export interface RuntimeLogReadResult {
  readonly source: string | null;
  readonly available: boolean;
  readonly capability: RuntimeDiagnosticSourceCapability;
  readonly text: string;
  readonly entries?: RuntimeEvent[];
  readonly path?: string;
  readonly encoding?: string;
  readonly bytesRead: number;
  readonly truncated: boolean;
  readonly query: NormalizedRuntimeLogQuery;
}

export interface RuntimeDiagnosticsCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface RuntimeDiagnosticsCommandOptions {
  readonly timeoutMs?: number;
}

export interface RuntimeDiagnosticsCommandRunner {
  run(
    command: string,
    args: readonly string[],
    options?: RuntimeDiagnosticsCommandOptions,
  ): Promise<RuntimeDiagnosticsCommandResult>;
}

export interface RuntimeDiagnosticsDependencies {
  readonly commandRunner?: RuntimeDiagnosticsCommandRunner;
  readonly platform?: NodeJS.Platform;
}

interface RuntimeEventProvider {
  readonly id: string;
  capability(): RuntimeDiagnosticSourceCapability;
  listEvents(query: NormalizedRuntimeEventQuery): Promise<RuntimeEvent[]>;
}

interface RuntimeLogProvider {
  readonly id: string;
  capability(): RuntimeDiagnosticSourceCapability;
  readLog(query: NormalizedRuntimeLogQuery): Promise<{
    readonly text: string;
    readonly entries?: RuntimeEvent[];
    readonly path?: string;
    readonly encoding?: string;
    readonly bytesRead: number;
    readonly truncated: boolean;
  }>;
}

class RuntimeDiagnosticUnavailableError extends Error {}

const WINDOWS_EVENT_LOG_SCRIPT = `
$ErrorActionPreference = "Stop"
$paramsJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($args[0]))
$params = $paramsJson | ConvertFrom-Json
$filter = @{ LogName = [string]$params.logName }
if ($null -ne $params.since -and [string]$params.since -ne "") {
  $filter.StartTime = [datetime]::Parse([string]$params.since, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
}
if ($null -ne $params.until -and [string]$params.until -ne "") {
  $filter.EndTime = [datetime]::Parse([string]$params.until, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal)
}
if ($null -ne $params.ids -and @($params.ids).Count -gt 0) {
  $filter.Id = @($params.ids)
}
try {
  $events = Get-WinEvent -FilterHashtable $filter -MaxEvents ([int]$params.fetchLimit) -ErrorAction Stop
} catch {
  if ([string]$_.FullyQualifiedErrorId -like "*NoMatchingEventsFound*" -or [string]$_.Exception.Message -like "*No events were found*") {
    $events = @()
  } else {
    throw
  }
}
$providerFilters = @()
if ($null -ne $params.providerNames) {
  $providerFilters = @($params.providerNames)
}
$levels = @()
if ($null -ne $params.levels) {
  $levels = @($params.levels)
}
$contains = ""
if ($null -ne $params.contains) {
  $contains = [string]$params.contains
}
$rows = New-Object System.Collections.Generic.List[object]
foreach ($event in $events) {
  if ($providerFilters.Count -gt 0) {
    $matchedProvider = $false
    foreach ($providerFilter in $providerFilters) {
      if ([string]$event.ProviderName -like "*$providerFilter*") {
        $matchedProvider = $true
        break
      }
    }
    if (-not $matchedProvider) {
      continue
    }
  }
  if ($levels.Count -gt 0 -and -not ($levels -contains [int]$event.Level)) {
    continue
  }
  $message = [string]$event.Message
  if ($contains -ne "" -and $message.IndexOf($contains, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
    continue
  }
  $timestamp = $null
  if ($null -ne $event.TimeCreated) {
    $timestamp = $event.TimeCreated.ToUniversalTime().ToString("o")
  }
  $rows.Add([pscustomobject]@{
    timestamp = $timestamp
    source = [string]$event.ProviderName
    provider = [string]$event.ProviderName
    logName = [string]$event.LogName
    id = [int]$event.Id
    level = [int]$event.Level
    levelDisplayName = [string]$event.LevelDisplayName
    message = $message
    machineName = [string]$event.MachineName
    recordId = [long]$event.RecordId
  })
  if ($rows.Count -ge [int]$params.limit) {
    break
  }
}
if ($rows.Count -eq 0) {
  "[]"
} else {
  $rows | ConvertTo-Json -Depth 5 -Compress
}
`;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as T;
}

function normalizeSeverity(
  input:
    | RuntimeDiagnosticSeverity
    | readonly RuntimeDiagnosticSeverity[]
    | undefined,
): RuntimeDiagnosticSeverity[] | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input === "string") {
    return [input];
  }

  return [...input];
}

function normalizeEventQuery(
  input: RuntimeEventQuery,
  defaultLimit: number,
): NormalizedRuntimeEventQuery {
  const normalized: {
    source?: string;
    limit: number;
    since?: string;
    until?: string;
    severity?: RuntimeDiagnosticSeverity[];
    contains?: string;
    ids?: number[];
  } = {
    limit: Math.min(input.limit ?? defaultLimit, defaultLimit),
  };

  const source = input.source?.trim();
  if (source !== undefined && source.length > 0) {
    normalized.source = source;
  }

  if (input.since !== undefined) {
    normalized.since = input.since;
  }

  if (input.until !== undefined) {
    normalized.until = input.until;
  }

  const severity = normalizeSeverity(input.severity);
  if (severity !== undefined) {
    normalized.severity = severity;
  }

  const contains = input.contains?.trim();
  if (contains !== undefined && contains.length > 0) {
    normalized.contains = contains;
  }

  if (input.id !== undefined) {
    normalized.ids = Array.isArray(input.id) ? [...input.id] : [input.id];
  }

  return normalized;
}

function normalizeLogQuery(
  input: RuntimeLogQuery,
  defaultLimitBytes: number,
): NormalizedRuntimeLogQuery {
  const normalized: {
    source?: string;
    limitBytes: number;
    tailLines?: number;
    since?: string;
    severity?: RuntimeDiagnosticSeverity[];
    contains?: string;
  } = {
    limitBytes: Math.min(input.limitBytes ?? defaultLimitBytes, defaultLimitBytes),
  };

  const source = input.source?.trim();
  if (source !== undefined && source.length > 0) {
    normalized.source = source;
  }

  if (input.tailLines !== undefined) {
    normalized.tailLines = input.tailLines;
  }

  if (input.since !== undefined) {
    normalized.since = input.since;
  }

  const severity = normalizeSeverity(input.severity);
  if (severity !== undefined) {
    normalized.severity = severity;
  }

  const contains = input.contains?.trim();
  if (contains !== undefined && contains.length > 0) {
    normalized.contains = contains;
  }

  return normalized;
}

function unavailableCapability(
  source: string | undefined,
  reason: string,
): RuntimeDiagnosticSourceCapability {
  return {
    id: source ?? "unconfigured",
    kind: "none",
    available: false,
    reason,
  };
}

function unavailableEventResult(
  query: NormalizedRuntimeEventQuery,
  capability: RuntimeDiagnosticSourceCapability,
): RuntimeEventListResult {
  return {
    source: query.source ?? null,
    available: false,
    capability,
    events: [],
    count: 0,
    truncated: false,
    query,
  };
}

function unavailableLogResult(
  query: NormalizedRuntimeLogQuery,
  capability: RuntimeDiagnosticSourceCapability,
): RuntimeLogReadResult {
  return {
    source: query.source ?? null,
    available: false,
    capability,
    text: "",
    bytesRead: 0,
    truncated: false,
    query,
  };
}

function severityToWindowsLevels(
  severity: readonly RuntimeDiagnosticSeverity[] | undefined,
): number[] | undefined {
  if (severity === undefined) {
    return undefined;
  }

  const levels = new Set<number>();
  for (const entry of severity) {
    if (entry === "critical") {
      levels.add(1);
    } else if (entry === "error") {
      levels.add(2);
    } else if (entry === "warning") {
      levels.add(3);
    } else if (entry === "info") {
      levels.add(4);
    } else if (entry === "verbose") {
      levels.add(5);
    } else if (entry === "unknown") {
      levels.add(0);
    }
  }

  return [...levels];
}

function severityFromWindowsLevel(level: unknown): RuntimeDiagnosticSeverity {
  if (level === 1) {
    return "critical";
  }

  if (level === 2) {
    return "error";
  }

  if (level === 3) {
    return "warning";
  }

  if (level === 4) {
    return "info";
  }

  if (level === 5) {
    return "verbose";
  }

  return "unknown";
}

function parseWindowsEventLogOutput(stdout: string): RuntimeEvent[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.flatMap((row): RuntimeEvent[] => {
    if (row === null || typeof row !== "object") {
      return [];
    }

    const value = row as Record<string, unknown>;
    const source =
      typeof value.source === "string" && value.source.length > 0
        ? value.source
        : "unknown";
    const timestamp =
      typeof value.timestamp === "string" && value.timestamp.length > 0
        ? value.timestamp
        : new Date(0).toISOString();
    const message =
      typeof value.message === "string" ? value.message.trim() : "";
    const event: {
      timestamp: string;
      source: string;
      severity: RuntimeDiagnosticSeverity;
      id?: number;
      message: string;
      provider?: string;
      logName?: string;
      recordId?: number;
      machineName?: string;
      raw?: unknown;
    } = {
      timestamp,
      source,
      severity: severityFromWindowsLevel(value.level),
      message,
      raw: value,
    };

    if (typeof value.id === "number") {
      event.id = value.id;
    }

    if (typeof value.provider === "string") {
      event.provider = value.provider;
    }

    if (typeof value.logName === "string") {
      event.logName = value.logName;
    }

    if (typeof value.recordId === "number") {
      event.recordId = value.recordId;
    }

    if (typeof value.machineName === "string") {
      event.machineName = value.machineName;
    }

    return [event];
  });
}

function formatEventLogLine(event: RuntimeEvent): string {
  const id = event.id === undefined ? "" : ` ${event.id}`;
  return `${event.timestamp} [${event.severity}] ${event.source}${id}: ${event.message}`;
}

function truncateUtf8(text: string, limitBytes: number): {
  readonly text: string;
  readonly truncated: boolean;
  readonly bytesRead: number;
} {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.byteLength <= limitBytes) {
    return {
      text,
      truncated: false,
      bytesRead: buffer.byteLength,
    };
  }

  const truncated = buffer.subarray(0, limitBytes).toString("utf8");
  return {
    text: truncated,
    truncated: true,
    bytesRead: limitBytes,
  };
}

class DefaultCommandRunner implements RuntimeDiagnosticsCommandRunner {
  async run(
    command: string,
    args: readonly string[],
    options: RuntimeDiagnosticsCommandOptions = {},
  ): Promise<RuntimeDiagnosticsCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let settled = false;
      const timeout =
        options.timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              settled = true;
              child.kill();
              reject(
                new Error(
                  `Diagnostic command ${command} timed out after ${options.timeoutMs} ms.`,
                ),
              );
            }, options.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.on("error", (error) => {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on("close", (exitCode) => {
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          exitCode: exitCode ?? 1,
        });
      });
    });
  }
}

async function runPowerShellScript(
  runner: RuntimeDiagnosticsCommandRunner,
  script: string,
  payload: unknown,
  timeoutMs: number,
): Promise<string> {
  const encodedScript = Buffer.from(script, "utf16le").toString("base64");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64",
  );
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encodedScript,
    encodedPayload,
  ];
  const commands = ["pwsh.exe", "powershell.exe"];
  let lastError: unknown;

  for (const command of commands) {
    try {
      const result = await runner.run(command, args, { timeoutMs });
      if (result.exitCode === 0) {
        return result.stdout;
      }

      lastError = new Error(
        result.stderr.trim() ||
          `Diagnostic command ${command} exited with code ${result.exitCode}.`,
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

class WindowsEventLogProvider implements RuntimeEventProvider, RuntimeLogProvider {
  readonly id: string;

  constructor(
    private readonly config: WindowsEventLogDiagnosticSourceConfig,
    private readonly runner: RuntimeDiagnosticsCommandRunner,
    private readonly platform: NodeJS.Platform,
  ) {
    this.id = config.id;
  }

  capability(): RuntimeDiagnosticSourceCapability {
    const capability: RuntimeDiagnosticSourceCapability = {
      id: this.config.id,
      kind: this.config.kind,
      available: this.platform === "win32",
    };

    if (this.platform !== "win32") {
      return {
        ...capability,
        reason: "Windows Event Log diagnostics are only available on Windows.",
      };
    }

    if (this.config.description !== undefined) {
      return {
        ...capability,
        description: this.config.description,
      };
    }

    return capability;
  }

  async listEvents(query: NormalizedRuntimeEventQuery): Promise<RuntimeEvent[]> {
    if (this.platform !== "win32") {
      throw new RuntimeDiagnosticUnavailableError(
        "Windows Event Log diagnostics are only available on Windows.",
      );
    }

    const payload = omitUndefined({
      logName: this.config.logName,
      providerNames: this.config.providerNames,
      limit: query.limit,
      fetchLimit: Math.max(query.limit, Math.min(query.limit * 20, 2_000)),
      since: query.since,
      until: query.until,
      levels: severityToWindowsLevels(query.severity),
      contains: query.contains,
      ids: query.ids,
    });
    const stdout = await runPowerShellScript(
      this.runner,
      WINDOWS_EVENT_LOG_SCRIPT,
      payload,
      this.config.commandTimeoutMs,
    );

    return parseWindowsEventLogOutput(stdout);
  }

  async readLog(query: NormalizedRuntimeLogQuery): Promise<{
    readonly text: string;
    readonly entries?: RuntimeEvent[];
    readonly bytesRead: number;
    readonly truncated: boolean;
  }> {
    const eventQuery: {
      source?: string;
      limit: number;
      since?: string;
      severity?: RuntimeDiagnosticSeverity[];
      contains?: string;
    } = {
      limit: query.tailLines ?? 50,
    };

    if (query.source !== undefined) {
      eventQuery.source = query.source;
    }

    if (query.since !== undefined) {
      eventQuery.since = query.since;
    }

    if (query.severity !== undefined) {
      eventQuery.severity = query.severity;
    }

    if (query.contains !== undefined) {
      eventQuery.contains = query.contains;
    }

    const events = await this.listEvents(eventQuery);
    const bounded = truncateUtf8(
      events.map(formatEventLogLine).join("\n"),
      query.limitBytes,
    );

    return {
      text: bounded.text,
      entries: events,
      bytesRead: bounded.bytesRead,
      truncated: bounded.truncated,
    };
  }
}

class FileLogProvider implements RuntimeLogProvider {
  readonly id: string;

  constructor(private readonly config: FileDiagnosticLogSourceConfig) {
    this.id = config.id;
  }

  capability(): RuntimeDiagnosticSourceCapability {
    const capability: RuntimeDiagnosticSourceCapability = {
      id: this.config.id,
      kind: this.config.kind,
      available: true,
    };

    if (this.config.description !== undefined) {
      return {
        ...capability,
        description: this.config.description,
      };
    }

    return capability;
  }

  async readLog(query: NormalizedRuntimeLogQuery): Promise<{
    readonly text: string;
    readonly path: string;
    readonly encoding: string;
    readonly bytesRead: number;
    readonly truncated: boolean;
  }> {
    const fileStat = await stat(this.config.path);
    const bytesToRead = Math.min(fileStat.size, query.limitBytes);
    const file = await open(this.config.path, "r");

    try {
      const buffer = Buffer.alloc(bytesToRead);
      await file.read(buffer, 0, bytesToRead, fileStat.size - bytesToRead);
      let text = buffer.toString(this.config.encoding as BufferEncoding);

      if (query.contains !== undefined && query.contains.length > 0) {
        const needle = query.contains.toLowerCase();
        text = text
          .split(/\r?\n/)
          .filter((line) => line.toLowerCase().includes(needle))
          .join("\n");
      }

      if (query.tailLines !== undefined) {
        text = text.split(/\r?\n/).slice(-query.tailLines).join("\n");
      }

      const bounded = truncateUtf8(text, query.limitBytes);

      return {
        text: bounded.text,
        path: this.config.path,
        encoding: this.config.encoding,
        bytesRead: bytesToRead,
        truncated: fileStat.size > bytesToRead || bounded.truncated,
      };
    } finally {
      await file.close();
    }
  }
}

function createEventProvider(
  source: WindowsEventLogDiagnosticSourceConfig,
  runner: RuntimeDiagnosticsCommandRunner,
  platform: NodeJS.Platform,
): RuntimeEventProvider {
  return new WindowsEventLogProvider(source, runner, platform);
}

function createLogProvider(
  source: RuntimeLogSourceConfig,
  runner: RuntimeDiagnosticsCommandRunner,
  platform: NodeJS.Platform,
): RuntimeLogProvider {
  if (source.kind === "windowsEventLog") {
    return new WindowsEventLogProvider(source, runner, platform);
  }

  return new FileLogProvider(source);
}

export class RuntimeDiagnostics {
  readonly #eventProviders: RuntimeEventProvider[];
  readonly #logProviders: RuntimeLogProvider[];
  readonly #config: RuntimeDiagnosticsConfig;

  constructor(
    config: RuntimeDiagnosticsConfig,
    dependencies: RuntimeDiagnosticsDependencies = {},
  ) {
    const runner = dependencies.commandRunner ?? new DefaultCommandRunner();
    const platform = dependencies.platform ?? process.platform;
    this.#config = config;
    this.#eventProviders = config.eventSources.map((source) =>
      createEventProvider(source, runner, platform),
    );
    this.#logProviders = config.logSources.map((source) =>
      createLogProvider(source, runner, platform),
    );
  }

  listCapabilities(): RuntimeDiagnosticsCapabilities {
    return {
      eventSources: this.#eventProviders.map((provider) =>
        provider.capability(),
      ),
      logSources: this.#logProviders.map((provider) => provider.capability()),
    };
  }

  async listEvents(input: RuntimeEventQuery = {}): Promise<RuntimeEventListResult> {
    const query = normalizeEventQuery(input, this.#config.maxEvents);
    const provider = this.#resolveEventProvider(query.source);

    if (provider === undefined) {
      return unavailableEventResult(
        query,
        unavailableCapability(
          query.source,
          query.source === undefined
            ? "No runtime event diagnostic source is configured."
            : `Runtime event diagnostic source "${query.source}" is not configured.`,
        ),
      );
    }

    const capability = provider.capability();
    if (!capability.available) {
      return unavailableEventResult(query, capability);
    }

    try {
      const events = await provider.listEvents(query);
      return {
        source: provider.id,
        available: true,
        capability,
        events,
        count: events.length,
        truncated: events.length >= query.limit,
        query,
      };
    } catch (error) {
      return unavailableEventResult(query, {
        ...capability,
        available: false,
        reason: errorMessage(error),
      });
    }
  }

  async listRuntimeErrors(
    input: RuntimeEventQuery = {},
  ): Promise<RuntimeErrorListResult> {
    const result = await this.listEvents({
      ...input,
      severity: input.severity ?? ["critical", "error"],
    });

    return {
      ...result,
      errors: result.events,
    };
  }

  async readLog(input: RuntimeLogQuery = {}): Promise<RuntimeLogReadResult> {
    const query = normalizeLogQuery(input, this.#config.maxLogBytes);
    const provider = this.#resolveLogProvider(query.source);

    if (provider === undefined) {
      return unavailableLogResult(
        query,
        unavailableCapability(
          query.source,
          query.source === undefined
            ? "No runtime log diagnostic source is configured."
            : `Runtime log diagnostic source "${query.source}" is not configured.`,
        ),
      );
    }

    const capability = provider.capability();
    if (!capability.available) {
      return unavailableLogResult(query, capability);
    }

    try {
      const result = await provider.readLog(query);
      return {
        source: provider.id,
        available: true,
        capability,
        ...result,
        query,
      };
    } catch (error) {
      return unavailableLogResult(query, {
        ...capability,
        available: false,
        reason: errorMessage(error),
      });
    }
  }

  #resolveEventProvider(source: string | undefined): RuntimeEventProvider | undefined {
    if (source === undefined || source.length === 0) {
      return this.#eventProviders[0];
    }

    return this.#eventProviders.find((provider) => provider.id === source);
  }

  #resolveLogProvider(source: string | undefined): RuntimeLogProvider | undefined {
    if (source === undefined || source.length === 0) {
      return this.#logProviders[0];
    }

    return this.#logProviders.find((provider) => provider.id === source);
  }
}
