import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEventResult,
  ToolDefinition as PiToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";

import { createExtension, type ExtensionConfigInput } from "./index.js";
import {
  persistTargetConfigUpdate,
  resolvePiConfig,
  type ResolvedPiConfig,
} from "./pi-config.js";

type RegisteredExtension = Awaited<ReturnType<ReturnType<typeof createExtension>["register"]>>;
type RegisteredTool = RegisteredExtension["tools"][number];
type RegisteredHook = RegisteredExtension["hooks"][number];

const emptySchema = Type.Object({}, { additionalProperties: false });
const symbolNameSchema = Type.String({ minLength: 1 });
const axisRefSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Integer({ minimum: 1 }),
]);
const ioDataPointNameSchema = Type.String({ minLength: 1 });
const watchModeType = Type.Union([
  Type.Literal("on-change"),
  Type.Literal("cyclic"),
]);
const writeModeType = Type.Union([
  Type.Literal("read-only"),
  Type.Literal("enabled"),
]);

function textContent(text: string) {
  return [{ type: "text" as const, text }];
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatSnapshotLine(snapshot: {
  name: string;
  value: unknown;
  type: string;
  timestamp: string;
}): string {
  return `- ${snapshot.name} = ${formatValue(snapshot.value)} (${snapshot.type}) @ ${snapshot.timestamp}`;
}

function formatAdsStateSummary(state: {
  plcRuntimeStatus?: {
    adsState: number;
    adsStateName: string;
    deviceState: number;
    isRun: boolean;
    isStop: boolean;
  };
  plcRuntimeState?: string | {
    adsState: number;
    adsStateStr?: string;
    deviceState: number;
  };
}): string {
  if (state.plcRuntimeStatus !== undefined) {
    const status = state.plcRuntimeStatus;
    return `${status.adsStateName} (adsState=${status.adsState}, deviceState=${status.deviceState})`;
  }

  if (
    state.plcRuntimeState &&
    typeof state.plcRuntimeState === "object" &&
    "adsState" in state.plcRuntimeState
  ) {
    const runtimeState = state.plcRuntimeState;
    return `${runtimeState.adsStateStr ?? `ADS state ${runtimeState.adsState}`} (adsState=${runtimeState.adsState}, deviceState=${runtimeState.deviceState})`;
  }

  return String(state.plcRuntimeState ?? "unknown");
}

function formatBootstrapSummary(summary: {
  state: {
    adsState: string;
    plcRuntimeState?: string | {
      adsState: number;
      adsStateStr?: string;
      deviceState: number;
    };
    plcRuntimeStatus?: {
      adsState: number;
      adsStateName: string;
      deviceState: number;
      isRun: boolean;
      isStop: boolean;
    };
    writeMode: string;
    watchCount: number;
    writePolicy: {
      configReadOnly: boolean;
      runtimeWriteEnabled: boolean;
      allowlistCount: number;
    };
  };
  snapshots: Array<{
    name: string;
    value: unknown;
    type: string;
    timestamp: string;
  }>;
  failedSnapshots: string[];
  watches: Array<{ name: string }>;
}): string {
  const lines = [
    "TwinCAT ADS bootstrap context:",
    `- ADS state: ${summary.state.adsState}`,
    `- PLC runtime state: ${formatAdsStateSummary(summary.state)}`,
    `- Runtime write mode: ${summary.state.writeMode}`,
    `- Active watches: ${summary.state.watchCount}`,
    `- Config read-only: ${summary.state.writePolicy.configReadOnly}`,
    `- Runtime writes enabled: ${summary.state.writePolicy.runtimeWriteEnabled}`,
    `- Write allowlist size: ${summary.state.writePolicy.allowlistCount}`,
  ];

  if (summary.snapshots.length > 0) {
    lines.push("- Snapshot symbols:");
    lines.push(...summary.snapshots.map(formatSnapshotLine));
  }

  if (summary.failedSnapshots.length > 0) {
    lines.push(
      `- Snapshot read failures: ${summary.failedSnapshots.join(", ")}`,
    );
  }

  if (summary.watches.length > 0) {
    lines.push(`- Registered watches: ${summary.watches.map((watch) => watch.name).join(", ")}`);
  }

  lines.push(
    "Treat this as live PLC telemetry. Verify state with plc_state/plc_read before making any write decisions.",
  );

  return lines.join("\n");
}

function formatTurnContext(context: {
  snapshots: Array<{
    name: string;
    value: unknown;
    type: string;
    timestamp: string;
  }>;
  failedSnapshots: string[];
  watchCount: number;
  writeMode: {
    writeMode: string;
    writesAllowed: boolean;
    message: string;
  };
}): string {
  const lines = [
    "System-generated PLC turn context:",
    `- Runtime write mode: ${context.writeMode.writeMode}`,
    `- Writes allowed right now: ${context.writeMode.writesAllowed}`,
    `- Write gate message: ${context.writeMode.message}`,
    `- Active watch count: ${context.watchCount}`,
  ];

  if (context.snapshots.length > 0) {
    lines.push("- Live snapshots:");
    lines.push(...context.snapshots.map(formatSnapshotLine));
  }

  if (context.failedSnapshots.length > 0) {
    lines.push(
      `- Snapshot read failures: ${context.failedSnapshots.join(", ")}`,
    );
  }

  return lines.join("\n");
}

function formatToolSuccess(toolName: string, data: unknown): string {
  if (toolName === "plc_read") {
    const result = (data as { result: { name: string; value: unknown; type: string; timestamp: string } }).result;
    return `Read ${result.name} = ${formatValue(result.value)} (${result.type}) @ ${result.timestamp}`;
  }

  if (toolName === "plc_read_many") {
    const result = data as { count: number };
    return `Read ${result.count} PLC symbols successfully.`;
  }

  if (toolName === "plc_list_symbols") {
    const result = data as { count: number };
    return `Listed ${result.count} PLC symbols.`;
  }

  if (toolName === "plc_describe_symbol") {
    const result = data as { symbol: { name: string; type: string; size: number } };
    return `Symbol ${result.symbol.name}: ${result.symbol.type}, ${result.symbol.size} bytes.`;
  }

  if (toolName === "plc_list_groups") {
    const result = data as { count: number };
    return `Listed ${result.count} PLC symbol groups.`;
  }

  if (toolName === "plc_read_group") {
    const result = data as { group: { group: string; count: number } };
    return `Read PLC group ${result.group.group} with ${result.group.count} symbols.`;
  }

  if (toolName === "plc_state") {
    const result = data as {
      adsState: string;
      plcRuntimeState?: string | {
        adsState: number;
        adsStateStr?: string;
        deviceState: number;
      };
      plcRuntimeStatus?: {
        adsState: number;
        adsStateName: string;
        deviceState: number;
        isRun: boolean;
        isStop: boolean;
      };
      writeMode: string;
      watchCount: number;
    };
    return `ADS=${result.adsState}, PLC=${formatAdsStateSummary(result)}, writeMode=${result.writeMode}, watches=${result.watchCount}`;
  }

  if (toolName === "nc_state") {
    const result = data as {
      adsState: string;
      ncRuntimeStatus?: {
        adsState: number;
        adsStateName: string;
        deviceState: number;
      };
      axes: unknown[];
    };
    const ncState =
      result.ncRuntimeStatus === undefined
        ? "unknown"
        : `${result.ncRuntimeStatus.adsStateName} (adsState=${result.ncRuntimeStatus.adsState}, deviceState=${result.ncRuntimeStatus.deviceState})`;
    return `ADS=${result.adsState}, NC=${ncState}, configured axes=${result.axes.length}`;
  }

  if (toolName === "nc_list_axes") {
    const result = data as { count: number };
    return `Listed ${result.count} configured NC axes.`;
  }

  if (toolName === "nc_read_axis") {
    const result = data as {
      result: {
        axis: { name: string; id: number };
        online: { actualPosition: number; actualVelocity: number };
        errorCode: number;
        timestamp: string;
      };
    };
    return `NC axis ${result.result.axis.name} (id ${result.result.axis.id}) position=${result.result.online.actualPosition}, velocity=${result.result.online.actualVelocity}, error=${result.result.errorCode} @ ${result.result.timestamp}`;
  }

  if (toolName === "nc_read_axis_many") {
    const result = data as { count: number };
    return `Read ${result.count} NC axes successfully.`;
  }

  if (toolName === "nc_read_error") {
    const result = data as {
      error: {
        axis: { name: string; id: number };
        errorCode: number;
        hasError: boolean;
        timestamp: string;
      };
    };
    return `NC axis ${result.error.axis.name} (id ${result.error.axis.id}) error=${result.error.errorCode}, hasError=${result.error.hasError} @ ${result.error.timestamp}`;
  }

  if (toolName === "io_list_groups") {
    const result = data as { count: number; dataPoints: unknown[] };
    return `Listed ${result.count} IO groups and ${result.dataPoints.length} configured IO data points.`;
  }

  if (toolName === "io_read") {
    const result = data as {
      result: {
        dataPoint: { name: string; type: string };
        value: unknown;
        timestamp: string;
      };
    };
    return `Read IO ${result.result.dataPoint.name} = ${formatValue(result.result.value)} (${result.result.dataPoint.type}) @ ${result.result.timestamp}`;
  }

  if (toolName === "io_read_many") {
    const result = data as { count: number };
    return `Read ${result.count} IO data points successfully.`;
  }

  if (toolName === "io_read_group") {
    const result = data as { group: { group: string; count: number } };
    return `Read IO group ${result.group.group} with ${result.group.count} data points.`;
  }

  if (toolName === "plc_watch") {
    const result = data as { watch: { name: string; notificationHandle: number } };
    return `Watch active for ${result.watch.name} (handle ${result.watch.notificationHandle}).`;
  }

  if (toolName === "plc_unwatch") {
    const result = data as { watch: { name: string; active: boolean } };
    return `Watch ${result.watch.name} is now active=${result.watch.active}.`;
  }

  if (toolName === "plc_list_watches") {
    const result = data as { count: number };
    return `There are ${result.count} registered PLC watches.`;
  }

  if (toolName === "plc_wait_until") {
    const result = data as { status: string; durationMs: number };
    return `PLC wait completed with status ${result.status} after ${result.durationMs} ms.`;
  }

  if (toolName === "plc_set_write_mode") {
    const result = data as { message: string };
    return result.message;
  }

  if (toolName === "plc_write") {
    const result = (data as {
      result: { name: string; value: unknown; type: string; timestamp: string };
    }).result;
    return `Wrote ${result.name} = ${formatValue(result.value)} (${result.type}) @ ${result.timestamp}`;
  }

  return JSON.stringify(data, null, 2);
}

async function getInternalTool(
  registration: RegisteredExtension,
  toolName: string,
): Promise<RegisteredTool> {
  const tool = registration.tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    throw new Error(`Internal tool "${toolName}" is not registered.`);
  }

  return tool;
}

async function getInternalHook(
  registration: RegisteredExtension,
  hookName: string,
): Promise<RegisteredHook> {
  const hook = registration.hooks.find((candidate) => candidate.name === hookName);
  if (!hook) {
    throw new Error(`Internal hook "${hookName}" is not registered.`);
  }

  return hook;
}

type ToolSpec = {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
};

const toolSpecs: ToolSpec[] = [
  {
    name: "plc_set_target",
    label: "PLC Target",
    description:
      "Persist the target AMS Net ID and optional ADS port in the active PLC config file.",
    parameters: Type.Object(
      {
        targetAmsNetId: Type.String({ minLength: 1 }),
        targetAdsPort: Type.Optional(
          Type.Integer({ minimum: 1, maximum: 65_535 }),
        ),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_list_symbols",
    label: "PLC Symbols",
    description: "List available PLC symbols with metadata.",
    parameters: Type.Object(
      {
        filter: Type.Optional(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_describe_symbol",
    label: "PLC Describe Symbol",
    description:
      "Describe a PLC symbol including type, size, metadata, arrays and struct members when available.",
    parameters: Type.Object(
      {
        name: symbolNameSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_set_write_mode",
    label: "PLC Write Mode",
    description:
      "Enable or disable PLC writes for the current session runtime gate.",
    parameters: Type.Object(
      {
        mode: writeModeType,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_read",
    label: "PLC Read",
    description: "Read a PLC symbol by name.",
    parameters: Type.Object(
      {
        name: symbolNameSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_read_many",
    label: "PLC Read Many",
    description: "Read multiple PLC symbols using a bundled ADS request.",
    parameters: Type.Object(
      {
        names: Type.Array(symbolNameSchema, {
          minItems: 1,
          maxItems: 100,
        }),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_list_groups",
    label: "PLC Groups",
    description: "List configured PLC symbol groups.",
    parameters: emptySchema,
  },
  {
    name: "plc_read_group",
    label: "PLC Read Group",
    description: "Read all symbols from a configured PLC symbol group.",
    parameters: Type.Object(
      {
        group: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "nc_state",
    label: "NC State",
    description: "Inspect NC ADS connection and runtime state.",
    parameters: emptySchema,
  },
  {
    name: "nc_list_axes",
    label: "NC Axes",
    description: "List configured NC axes.",
    parameters: emptySchema,
  },
  {
    name: "nc_read_axis",
    label: "NC Read Axis",
    description:
      "Read configured NC axis online state, status flags, position, velocity, and error code.",
    parameters: Type.Object(
      {
        axis: axisRefSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "nc_read_axis_many",
    label: "NC Read Axes",
    description: "Read multiple configured NC axes.",
    parameters: Type.Object(
      {
        axes: Type.Array(axisRefSchema, {
          minItems: 1,
          maxItems: 64,
        }),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "nc_read_error",
    label: "NC Read Error",
    description: "Read the current error code for a configured NC axis.",
    parameters: Type.Object(
      {
        axis: axisRefSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "io_list_groups",
    label: "IO Groups",
    description: "List configured IO groups and data points.",
    parameters: emptySchema,
  },
  {
    name: "io_read",
    label: "IO Read",
    description: "Read a configured IO data point by ADS indexGroup/indexOffset.",
    parameters: Type.Object(
      {
        name: ioDataPointNameSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "io_read_many",
    label: "IO Read Many",
    description: "Read multiple configured IO data points with one ADS sum read.",
    parameters: Type.Object(
      {
        names: Type.Array(ioDataPointNameSchema, {
          minItems: 1,
          maxItems: 250,
        }),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "io_read_group",
    label: "IO Read Group",
    description: "Read all configured IO data points in an IO group.",
    parameters: Type.Object(
      {
        group: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_watch",
    label: "PLC Watch",
    description: "Register or reuse a PLC notification watch for a symbol.",
    parameters: Type.Object(
      {
        name: symbolNameSchema,
        mode: Type.Optional(watchModeType),
        cycleTimeMs: Type.Optional(
          Type.Integer({ minimum: 10, maximum: 60_000 }),
        ),
        maxDelayMs: Type.Optional(
          Type.Integer({ minimum: 0, maximum: 60_000 }),
        ),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_unwatch",
    label: "PLC Unwatch",
    description: "Remove a previously registered PLC watch by symbol name.",
    parameters: Type.Object(
      {
        name: symbolNameSchema,
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_list_watches",
    label: "PLC Watches",
    description: "List currently registered PLC watches for this session.",
    parameters: emptySchema,
  },
  {
    name: "plc_wait_until",
    label: "PLC Wait Until",
    description:
      "Wait for PLC symbol conditions to become true, optionally requiring a stable duration.",
    parameters: Type.Object(
      {
        condition: Type.Any(),
        timeoutMs: Type.Integer({ minimum: 1, maximum: 3_600_000 }),
        stableForMs: Type.Optional(
          Type.Integer({ minimum: 0, maximum: 3_600_000 }),
        ),
        cycleTimeMs: Type.Optional(
          Type.Integer({ minimum: 10, maximum: 60_000 }),
        ),
        maxDelayMs: Type.Optional(
          Type.Integer({ minimum: 0, maximum: 60_000 }),
        ),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_write",
    label: "PLC Write",
    description:
      "Write a PLC symbol when config and runtime write gates permit it.",
    parameters: Type.Object(
      {
        name: symbolNameSchema,
        value: Type.Any(),
      },
      { additionalProperties: false },
    ),
  },
  {
    name: "plc_state",
    label: "PLC State",
    description: "Inspect TwinCAT runtime and ADS connection state.",
    parameters: emptySchema,
  },
];

async function runHook<TOutput>(
  registration: RegisteredExtension,
  hookName: string,
  input: unknown,
): Promise<TOutput> {
  const hook = await getInternalHook(registration, hookName);
  const execute = hook.execute as (rawInput: unknown) => Promise<unknown>;
  const result = (await execute(input)) as Awaited<ReturnType<RegisteredHook["execute"]>>;

  if (!result.ok) {
    throw new Error(`[${hookName}] ${result.error.message}`);
  }

  return result.data as TOutput;
}

function buildContextMessage(content: string) {
  const message: AgentMessage = {
    role: "user",
    content,
    timestamp: Date.now(),
  };

  return message;
}

function setStatus(ctx: ExtensionContext, message: string | undefined): void {
  ctx.ui.setStatus("plc-ads", message);
}

export default function piTwinCatAdsExtension(pi: ExtensionAPI): void {
  pi.registerFlag("plc-config", {
    description:
      "Path to a pi-twincat-ads JSON config file, or an inline JSON string.",
    type: "string",
  });

  let registrationPromise: Promise<RegisteredExtension> | undefined;
  let activeResolvedConfig: ResolvedPiConfig | undefined;

  const loadResolvedConfig = async (): Promise<ResolvedPiConfig> => {
    const plcConfigFlag = pi.getFlag("plc-config");
    const resolveOptions = {
      cwd: process.cwd(),
    } as {
      cwd: string;
      flagValue?: string;
      envPath?: string;
      envJson?: string;
    };

    if (typeof plcConfigFlag === "string") {
      resolveOptions.flagValue = plcConfigFlag;
    }

    if (process.env.PI_TWINCAT_ADS_CONFIG !== undefined) {
      resolveOptions.envPath = process.env.PI_TWINCAT_ADS_CONFIG;
    }

    if (process.env.PI_TWINCAT_ADS_CONFIG_JSON !== undefined) {
      resolveOptions.envJson = process.env.PI_TWINCAT_ADS_CONFIG_JSON;
    }

    const resolved = await resolvePiConfig(resolveOptions);

    activeResolvedConfig = resolved;
    return resolved;
  };

  const resetRegistration = async (): Promise<void> => {
    if (!registrationPromise) {
      return;
    }

    const registration = await getRegistration();
    await runHook(registration, "session_end", {});
    registrationPromise = undefined;
  };

  const getRegistration = async (): Promise<RegisteredExtension> => {
    if (!registrationPromise) {
      registrationPromise = (async () => {
        const resolvedConfig = await loadResolvedConfig();
        const extension = createExtension(resolvedConfig.config);
        return extension.register();
      })().catch((error) => {
        registrationPromise = undefined;
        throw error;
      });
    }

    return registrationPromise;
  };

  for (const spec of toolSpecs) {
    const tool: PiToolDefinition<TSchema, unknown> = {
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: spec.parameters,
      async execute(toolCallId, params, signal, _onUpdate, _ctx) {
        if (spec.name === "plc_set_target") {
          const resolvedConfig = activeResolvedConfig ?? (await loadResolvedConfig());

          if (!resolvedConfig.configPath) {
            throw new Error(
              "The active PLC config was provided as inline JSON and cannot be updated persistently. Use a plc.config.json file instead.",
            );
          }

          const input = params as {
            targetAmsNetId: string;
            targetAdsPort?: number;
          };
          const updateOptions = {
            configPath: resolvedConfig.configPath,
            targetAmsNetId: input.targetAmsNetId,
          } as {
            configPath: string;
            targetAmsNetId: string;
            targetAdsPort?: number;
          };

          if (input.targetAdsPort !== undefined) {
            updateOptions.targetAdsPort = input.targetAdsPort;
          }

          const nextConfig = await persistTargetConfigUpdate(updateOptions);

          await resetRegistration();

          return {
            content: textContent(
              `Persisted PLC target ${nextConfig.targetAmsNetId}:${nextConfig.targetAdsPort} in ${resolvedConfig.configPath}.`,
            ),
            details: {
              configPath: resolvedConfig.configPath,
              targetAmsNetId: nextConfig.targetAmsNetId,
              targetAdsPort: nextConfig.targetAdsPort,
            },
          };
        }

        const registration = await getRegistration();
        const internalTool = await getInternalTool(registration, spec.name);
        const execute = internalTool.execute as (
          rawInput: unknown,
          signal?: AbortSignal,
        ) => Promise<unknown>;
        const result = (await execute(params, signal)) as Awaited<
          ReturnType<RegisteredTool["execute"]>
        >;

        if (!result.ok) {
          const error = new Error(result.error.message);
          Object.assign(error, { code: result.error.code });
          throw error;
        }

        return {
          content: textContent(formatToolSuccess(spec.name, result.data)),
          details: result.data,
        };
      },
    };

    pi.registerTool(tool);
  }

  pi.on("session_start", async (_event, ctx) => {
    const registration = await getRegistration();
    const result = await runHook<{
      state: {
        adsState: string;
        plcRuntimeState?: string | {
          adsState: number;
          adsStateStr?: string;
          deviceState: number;
        };
        plcRuntimeStatus?: {
          adsState: number;
          adsStateName: string;
          deviceState: number;
          isRun: boolean;
          isStop: boolean;
        };
      };
      snapshotCount: number;
      failedSnapshots: string[];
    }>(registration, "session_start", {});

    const status = `ADS ${result.state.adsState}, PLC ${formatAdsStateSummary(result.state)}, snapshots ${result.snapshotCount}`;
    setStatus(ctx, status);

    if (result.failedSnapshots.length > 0) {
      ctx.ui.notify(
        `PLC snapshot reads failed: ${result.failedSnapshots.join(", ")}`,
        "warning",
      );
    }
  });

  pi.on("before_agent_start", async (event) => {
    const registration = await getRegistration();
    const result = await runHook<{
      summary: {
        state: {
          adsState: string;
          plcRuntimeState?: string | {
            adsState: number;
            adsStateStr?: string;
            deviceState: number;
          };
          plcRuntimeStatus?: {
            adsState: number;
            adsStateName: string;
            deviceState: number;
            isRun: boolean;
            isStop: boolean;
          };
          writeMode: string;
          watchCount: number;
          writePolicy: {
            configReadOnly: boolean;
            runtimeWriteEnabled: boolean;
            allowlistCount: number;
          };
        };
        snapshots: Array<{
          name: string;
          value: unknown;
          type: string;
          timestamp: string;
        }>;
        failedSnapshots: string[];
        watches: Array<{ name: string }>;
      };
    }>(registration, "before_agent_start", {});

    return {
      systemPrompt: `${event.systemPrompt}\n\n${formatBootstrapSummary(result.summary)}`,
    };
  });

  pi.on("context", async (event) => {
    const registration = await getRegistration();
    const result = await runHook<{
      context: {
        snapshots: Array<{
          name: string;
          value: unknown;
          type: string;
          timestamp: string;
        }>;
        failedSnapshots: string[];
        watchCount: number;
        writeMode: {
          writeMode: string;
          writesAllowed: boolean;
          message: string;
        };
      };
    }>(registration, "context", {});

    const contextMessage = buildContextMessage(
      formatTurnContext(result.context),
    );

    return {
      messages: [...event.messages, contextMessage],
    };
  });

  pi.on("tool_call", async (event): Promise<ToolCallEventResult | void> => {
    const registration = await getRegistration();
    const result = await runHook<{
      allow: boolean;
      requiresConfirmation: boolean;
      reason?: string;
    }>(registration, "tool_call", {
      toolName: event.toolName,
      arguments: event.input,
    });

    if (result.allow) {
      return;
    }

    return {
      block: true,
      reason: result.reason ?? `Tool call ${event.toolName} was blocked.`,
    };
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!registrationPromise) {
      return;
    }

    const registration = await getRegistration();
    await runHook(registration, "session_end", {});
    setStatus(ctx, undefined);
  });
}
