import { z } from "zod";

import type {
  PlcReadResult,
  PlcStateResult,
  PlcWriteModeResult,
  TwinCatAdsRuntime,
} from "twincat-mcp-core";
import type { ExtensionRuntimeConfig } from "../config.js";

const emptyInputSchema = z.object({}).strict();

const toolCallInputSchema = z
  .object({
    toolName: z.string().trim().min(1, "Tool name must not be empty."),
    arguments: z.unknown().optional(),
  })
  .strict();

export interface HookHandlerContext {
  readonly runtime: TwinCatAdsRuntime;
  readonly config: ExtensionRuntimeConfig;
}

export interface HookSuccessResult<TOutput> {
  readonly ok: true;
  readonly data: TOutput;
}

export interface HookFailureResult {
  readonly ok: false;
  readonly error: {
    readonly message: string;
    readonly code: "HOOK_INPUT_INVALID" | "HOOK_EXECUTION_FAILED";
  };
}

export type HookExecutionResult<TOutput> =
  | HookSuccessResult<TOutput>
  | HookFailureResult;

export interface HookDefinition<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  execute(
    rawInput: unknown,
    context: HookHandlerContext,
  ): Promise<HookExecutionResult<TOutput>>;
}

export interface SessionStartHookOutput {
  readonly connected: true;
  readonly state: PlcStateResult;
  readonly snapshotCount: number;
  readonly failedSnapshots: string[];
}

export interface AgentStartHookOutput {
  readonly summary: {
    readonly state: PlcStateResult;
    readonly snapshots: PlcReadResult[];
    readonly failedSnapshots: string[];
    readonly watches: ReturnType<TwinCatAdsRuntime["listWatches"]>;
  };
}

export interface ContextHookOutput {
  readonly context: {
    readonly snapshots: PlcReadResult[];
    readonly failedSnapshots: string[];
    readonly watchCount: number;
    readonly writeMode: PlcWriteModeResult;
  };
}

export interface ToolCallHookOutput {
  readonly allow: boolean;
  readonly requiresConfirmation: boolean;
  readonly reason?: string;
  readonly writeMode: PlcWriteModeResult;
}

export interface SessionEndHookOutput {
  readonly disconnected: true;
}

function normalizeHookError(error: unknown): HookFailureResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: "HOOK_INPUT_INVALID",
        message: error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "HOOK_EXECUTION_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function createHookDefinition<TInput, TOutput>(options: {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly handler: (
    input: TInput,
    context: HookHandlerContext,
  ) => Promise<TOutput>;
}): HookDefinition<TInput, TOutput> {
  return {
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    async execute(rawInput, context) {
      try {
        const input = options.inputSchema.parse(rawInput);
        const data = await options.handler(input, context);
        return {
          ok: true,
          data,
        };
      } catch (error) {
        return normalizeHookError(error);
      }
    },
  };
}

async function readConfiguredSnapshots(
  context: HookHandlerContext,
): Promise<{ snapshots: PlcReadResult[]; failedSnapshots: string[] }> {
  const snapshotSymbols = context.config.contextSnapshotSymbols;

  if (snapshotSymbols.length === 0) {
    return {
      snapshots: [],
      failedSnapshots: [],
    };
  }

  const settled = await Promise.allSettled(
    snapshotSymbols.map((name) => context.runtime.readSymbol({ name })),
  );

  const snapshots: PlcReadResult[] = [];
  const failedSnapshots: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      snapshots.push(result.value);
      return;
    }

    const symbolName = snapshotSymbols[index];
    if (symbolName) {
      failedSnapshots.push(symbolName);
    }
  });

  return {
    snapshots,
    failedSnapshots,
  };
}

function extractSymbolNameFromWriteArguments(argumentsValue: unknown): string | undefined {
  if (
    argumentsValue &&
    typeof argumentsValue === "object" &&
    "name" in argumentsValue &&
    typeof argumentsValue.name === "string"
  ) {
    return argumentsValue.name.trim();
  }

  return undefined;
}

function extractWriteModeFromArguments(
  argumentsValue: unknown,
): "read-only" | "enabled" | undefined {
  if (
    argumentsValue &&
    typeof argumentsValue === "object" &&
    "mode" in argumentsValue &&
    (argumentsValue.mode === "read-only" || argumentsValue.mode === "enabled")
  ) {
    return argumentsValue.mode;
  }

  return undefined;
}

export function createHookDefinitions(): HookDefinition<unknown, unknown>[] {
  return [
    createHookDefinition({
      name: "session_start",
      description: "Open ADS connection and hydrate caches.",
      inputSchema: emptyInputSchema,
      handler: async (_input, context) => {
        await context.runtime.connect();
        const [state, snapshotResult] = await Promise.all([
          context.runtime.readState(),
          readConfiguredSnapshots(context),
        ]);

        return {
          connected: true,
          state,
          snapshotCount: snapshotResult.snapshots.length,
          failedSnapshots: snapshotResult.failedSnapshots,
        };
      },
    }),
    createHookDefinition({
      name: "before_agent_start",
      description: "Inject a compact startup snapshot for the PLC.",
      inputSchema: emptyInputSchema,
      handler: async (_input, context) => {
        const [state, snapshotResult] = await Promise.all([
          context.runtime.readState(),
          readConfiguredSnapshots(context),
        ]);

        return {
          summary: {
            state,
            snapshots: snapshotResult.snapshots,
            failedSnapshots: snapshotResult.failedSnapshots,
            watches: context.runtime.listWatches(),
          },
        };
      },
    }),
    createHookDefinition({
      name: "context",
      description: "Inject live PLC context for configured snapshot symbols.",
      inputSchema: emptyInputSchema,
      handler: async (_input, context) => {
        const snapshotResult = await readConfiguredSnapshots(context);

        return {
          context: {
            snapshots: snapshotResult.snapshots,
            failedSnapshots: snapshotResult.failedSnapshots,
            watchCount: context.runtime.listWatches().length,
            writeMode: context.runtime.getWriteModeState(),
          },
        };
      },
    }),
    createHookDefinition({
      name: "tool_call",
      description: "Enforce write policy before PLC mutations execute.",
      inputSchema: toolCallInputSchema,
      handler: async (input, context) => {
        if (input.toolName === "plc_write") {
          const symbolName = extractSymbolNameFromWriteArguments(input.arguments);

          if (!symbolName) {
            return {
              allow: false,
              requiresConfirmation: false,
              reason:
                "plc_write requires a string symbol name in arguments.name before the call can be evaluated.",
              writeMode: context.runtime.getWriteModeState(),
            };
          }

          const writeAccess = context.runtime.evaluateWriteAccess(symbolName);

          return {
            allow: writeAccess.allow,
            requiresConfirmation: writeAccess.allow,
            reason: writeAccess.reason,
            writeMode: context.runtime.getWriteModeState(),
          };
        }

        if (input.toolName === "plc_set_write_mode") {
          const writeMode = context.runtime.getWriteModeState();
          const targetMode = extractWriteModeFromArguments(input.arguments);
          const blockedByConfig =
            writeMode.configReadOnly && targetMode === "enabled";

          return {
            allow: !blockedByConfig,
            requiresConfirmation: false,
            reason: blockedByConfig
              ? "Write mode cannot be enabled because config.readOnly is true."
              : undefined,
            writeMode,
          };
        }

        return {
          allow: true,
          requiresConfirmation: false,
          writeMode: context.runtime.getWriteModeState(),
        };
      },
    }),
    createHookDefinition({
      name: "session_end",
      description: "Release notifications, handles, and the ADS connection.",
      inputSchema: emptyInputSchema,
      handler: async (_input, context) => {
        await context.runtime.disconnect();
        return {
          disconnected: true,
        };
      },
    }),
  ];
}

export { emptyInputSchema, toolCallInputSchema };
