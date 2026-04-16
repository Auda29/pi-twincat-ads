import { z } from "zod";

import type {
  AdsService,
  PlcReadResult,
  PlcStateResult,
  PlcSymbolSummary,
} from "../ads/index.js";

const symbolNameSchema = z
  .string()
  .trim()
  .min(1, "Symbol name must not be empty.")
  .transform((value) => value.trim());

const listSymbolsInputSchema = z.object({
  filter: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => value?.trim()),
});

const readInputSchema = z.object({
  name: symbolNameSchema,
});

const readManyInputSchema = z.object({
  names: z
    .array(symbolNameSchema)
    .min(1, "At least one PLC symbol is required.")
    .max(100, "At most 100 PLC symbols can be read at once."),
});

const stateInputSchema = z.object({});

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
    readonly code: "TOOL_INPUT_INVALID" | "PLC_OPERATION_FAILED";
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
};
