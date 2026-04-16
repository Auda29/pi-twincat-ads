import { z } from "zod";

import type {
  AdsService,
  PlcReadResult,
  PlcStateResult,
  PlcSymbolSummary,
  PlcWatchMode,
  PlcWatchSnapshot,
  PlcWriteModeResult,
} from "../ads/index.js";

class WriteDeniedError extends Error {
  readonly code = "WRITE_DENIED" as const;
}

const symbolNameSchema = z
  .string()
  .trim()
  .min(1, "Symbol name must not be empty.");

const watchModeSchema = z.enum(["on-change", "cyclic"]);

const listSymbolsInputSchema = z
  .object({
    filter: z.string().trim().min(1).optional(),
  })
  .strict();

const readInputSchema = z
  .object({
    name: symbolNameSchema,
  })
  .strict();

const readManyInputSchema = z
  .object({
    names: z
      .array(symbolNameSchema)
      .min(1, "At least one PLC symbol is required.")
      .max(100, "At most 100 PLC symbols can be read at once."),
  })
  .strict();

const stateInputSchema = z.object({}).strict();

const writeInputSchema = z
  .object({
    name: symbolNameSchema,
    value: z.unknown(),
  })
  .strict();

const setWriteModeInputSchema = z
  .object({
    mode: z.enum(["read-only", "enabled"]),
  })
  .strict();

const watchInputSchema = z
  .object({
    name: symbolNameSchema,
    mode: watchModeSchema.optional(),
    cycleTimeMs: z
      .number()
      .int()
      .min(10, "Watch cycle time must be at least 10 ms.")
      .max(60_000, "Watch cycle time must be 60000 ms or lower.")
      .optional(),
    maxDelayMs: z
      .number()
      .int()
      .min(0, "Watch max delay must be 0 ms or higher.")
      .max(60_000, "Watch max delay must be 60000 ms or lower.")
      .optional(),
  })
  .strict();

const unwatchInputSchema = z
  .object({
    name: symbolNameSchema,
  })
  .strict();

const listWatchesInputSchema = z.object({}).strict();

export interface ToolHandlerContext {
  readonly adsService: AdsService;
}

export interface ToolSuccessResult<TOutput> {
  readonly ok: true;
  readonly data: TOutput;
}

export interface ToolFailureResult {
  readonly ok: false;
  readonly error: {
    readonly message: string;
    readonly code:
      | "TOOL_INPUT_INVALID"
      | "PLC_OPERATION_FAILED"
      | "WRITE_DENIED";
  };
}

export type ToolExecutionResult<TOutput> =
  | ToolSuccessResult<TOutput>
  | ToolFailureResult;

export interface ToolDefinition<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  execute(
    rawInput: unknown,
    context: ToolHandlerContext,
  ): Promise<ToolExecutionResult<TOutput>>;
}

export interface PlcStateToolOutput extends PlcStateResult {}
export interface PlcListSymbolsToolOutput {
  readonly symbols: PlcSymbolSummary[];
  readonly count: number;
}
export interface PlcReadToolOutput {
  readonly result: PlcReadResult;
}
export interface PlcReadManyToolOutput {
  readonly results: PlcReadResult[];
  readonly count: number;
}
export interface PlcWriteToolOutput {
  readonly result: {
    readonly name: string;
    readonly value: unknown;
    readonly type: string;
    readonly timestamp: string;
  };
}
export interface PlcSetWriteModeToolOutput extends PlcWriteModeResult {}
export interface PlcWatchToolOutput {
  readonly watch: PlcWatchSnapshot;
}
export interface PlcUnwatchToolOutput {
  readonly watch: PlcWatchSnapshot;
}
export interface PlcListWatchesToolOutput {
  readonly watches: PlcWatchSnapshot[];
  readonly count: number;
}

function normalizeToolError(error: unknown): ToolFailureResult {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: "TOOL_INPUT_INVALID",
        message: error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }

  if (error instanceof WriteDeniedError) {
    return {
      ok: false,
      error: {
        code: "WRITE_DENIED",
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "PLC_OPERATION_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function createToolDefinition<TInput, TOutput>(options: {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly handler: (
    input: TInput,
    context: ToolHandlerContext,
  ) => Promise<TOutput>;
}): ToolDefinition<TInput, TOutput> {
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
        return normalizeToolError(error);
      }
    },
  };
}

export function createToolDefinitions(): Array<
  | ToolDefinition<z.infer<typeof listSymbolsInputSchema>, PlcListSymbolsToolOutput>
  | ToolDefinition<z.infer<typeof readInputSchema>, PlcReadToolOutput>
  | ToolDefinition<z.infer<typeof readManyInputSchema>, PlcReadManyToolOutput>
  | ToolDefinition<z.infer<typeof stateInputSchema>, PlcStateToolOutput>
  | ToolDefinition<z.infer<typeof writeInputSchema>, PlcWriteToolOutput>
  | ToolDefinition<
      z.infer<typeof setWriteModeInputSchema>,
      PlcSetWriteModeToolOutput
    >
  | ToolDefinition<z.infer<typeof watchInputSchema>, PlcWatchToolOutput>
  | ToolDefinition<z.infer<typeof unwatchInputSchema>, PlcUnwatchToolOutput>
  | ToolDefinition<
      z.infer<typeof listWatchesInputSchema>,
      PlcListWatchesToolOutput
    >
> {
  return [
    createToolDefinition({
      name: "plc_list_symbols",
      description: "List available PLC symbols with metadata.",
      inputSchema: listSymbolsInputSchema,
      handler: async (input, context) => {
        const symbols = await context.adsService.listSymbols(input.filter);
        return {
          symbols,
          count: symbols.length,
        };
      },
    }),
    createToolDefinition({
      name: "plc_set_write_mode",
      description:
        "Enable or disable PLC writes for the current session runtime gate.",
      inputSchema: setWriteModeInputSchema,
      handler: async (input, context) => context.adsService.setWriteMode(input.mode),
    }),
    createToolDefinition({
      name: "plc_read",
      description: "Read a PLC symbol by name.",
      inputSchema: readInputSchema,
      handler: async (input, context) => {
        const result = await context.adsService.readValue(input.name);
        return { result };
      },
    }),
    createToolDefinition({
      name: "plc_read_many",
      description: "Read multiple PLC symbols using a bundled ADS request.",
      inputSchema: readManyInputSchema,
      handler: async (input, context) => {
        const results = await context.adsService.readMany(input.names);
        return {
          results,
          count: results.length,
        };
      },
    }),
    createToolDefinition({
      name: "plc_watch",
      description:
        "Register or reuse a PLC notification watch for a symbol.",
      inputSchema: watchInputSchema,
      handler: async (input, context): Promise<PlcWatchToolOutput> => {
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

        const watch = await context.adsService.watchValue(
          input.name,
          undefined,
          watchOptions,
        );

        const snapshot: {
          name: string;
          notificationHandle: number;
          cycleTimeMs: number;
          mode: PlcWatchMode;
          active: boolean;
          lastValue?: unknown;
          lastTimestamp?: string;
        } = {
          name: watch.name,
          notificationHandle: watch.notificationHandle,
          cycleTimeMs: watch.cycleTimeMs,
          mode: watch.mode,
          active: true,
        };

        if (watch.lastValue !== undefined) {
          snapshot.lastValue = watch.lastValue;
        }

        if (watch.lastTimestamp !== undefined) {
          snapshot.lastTimestamp = watch.lastTimestamp;
        }

        return {
          watch: snapshot,
        };
      },
    }),
    createToolDefinition({
      name: "plc_unwatch",
      description: "Remove a previously registered PLC watch by symbol name.",
      inputSchema: unwatchInputSchema,
      handler: async (input, context) => {
        const watch = await context.adsService.unwatchValue(input.name);
        return { watch };
      },
    }),
    createToolDefinition({
      name: "plc_list_watches",
      description: "List currently registered PLC watches for this session.",
      inputSchema: listWatchesInputSchema,
      handler: async (_input, context) => {
        const watches = context.adsService.listWatches();
        return {
          watches,
          count: watches.length,
        };
      },
    }),
    createToolDefinition({
      name: "plc_write",
      description:
        "Write a PLC symbol when config and runtime write gates permit it.",
      inputSchema: writeInputSchema,
      handler: async (input, context) => {
        let writeResult;

        try {
          writeResult = await context.adsService.writeValue(input.name, input.value);
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes("disabled by configuration") ||
              error.message.includes("blocked by the runtime write gate") ||
              error.message.includes("not in the configured writeAllowlist") ||
              error.message.includes("allowlist is empty"))
          ) {
            throw new WriteDeniedError(error.message);
          }

          throw error;
        }

        return {
          result: {
            name: writeResult.symbol.name,
            value: writeResult.value,
            type: writeResult.dataType.name,
            timestamp: new Date().toISOString(),
          },
        };
      },
    }),
    createToolDefinition({
      name: "plc_state",
      description: "Inspect TwinCAT runtime and ADS connection state.",
      inputSchema: stateInputSchema,
      handler: async (_input, context) => context.adsService.readState(),
    }),
  ];
}

export {
  listSymbolsInputSchema,
  readInputSchema,
  readManyInputSchema,
  stateInputSchema,
  writeInputSchema,
  setWriteModeInputSchema,
  watchInputSchema,
  unwatchInputSchema,
  listWatchesInputSchema,
  WriteDeniedError,
};
