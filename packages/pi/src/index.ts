import { AdsService, type AdsServiceDependencies } from "./ads/index.js";
import { createTwinCatAdsRuntime, type TwinCatAdsRuntime } from "twincat-mcp-core";
import {
  normalizeExtensionConfig,
  type ExtensionConfigInput,
  type ExtensionRuntimeConfig,
} from "./config.js";
import {
  createHookDefinitions,
  type HookDefinition,
  type HookHandlerContext,
} from "./hooks/index.js";
import {
  createToolDefinitions,
  type ToolDefinition,
  type ToolExecutionResult,
  type ToolHandlerContext,
} from "./tools/index.js";

export interface RegisteredToolDefinition<TOutput = unknown>
  extends Omit<ToolDefinition<unknown, TOutput>, "execute"> {
  execute(
    rawInput: unknown,
    signal?: AbortSignal,
  ): Promise<ToolExecutionResult<TOutput>>;
}

export interface ExtensionRegistration {
  readonly tools: RegisteredToolDefinition<unknown>[];
  readonly hooks: HookDefinition<unknown, unknown>[];
}

export interface PiTwinCatAdsExtension {
  readonly name: "pi-twincat-ads";
  readonly config: ExtensionRuntimeConfig;
  readonly adsService: AdsService;
  readonly runtime: TwinCatAdsRuntime;
  readonly tools: RegisteredToolDefinition<unknown>[];
  readonly hooks: HookDefinition<unknown, unknown>[];
  register(): Promise<ExtensionRegistration>;
}

class PiTwinCatAdsExtensionImpl implements PiTwinCatAdsExtension {
  readonly name = "pi-twincat-ads" as const;
  readonly adsService: AdsService;
  readonly runtime: TwinCatAdsRuntime;
  readonly tools: RegisteredToolDefinition<unknown>[];
  readonly hooks: HookDefinition<unknown, unknown>[];

  constructor(
    readonly config: ExtensionRuntimeConfig,
    dependencies: AdsServiceDependencies = {},
  ) {
    this.adsService = new AdsService(config, dependencies);
    this.runtime = createTwinCatAdsRuntime(this.adsService, { config });

    const toolContext: ToolHandlerContext = {
      runtime: this.runtime,
    };
    const hookContext: HookHandlerContext = {
      runtime: this.runtime,
      config,
    };

    this.tools = createToolDefinitions().map((tool): RegisteredToolDefinition => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as ToolDefinition<unknown, unknown>["inputSchema"],
      execute: (rawInput: unknown, signal?: AbortSignal) => {
        const context =
          signal === undefined ? toolContext : { ...toolContext, signal };
        return tool.execute(rawInput, context);
      },
    }));

    this.hooks = createHookDefinitions().map((hook) => ({
      ...hook,
      execute: (rawInput) => hook.execute(rawInput, hookContext),
    }));
  }

  async register(): Promise<ExtensionRegistration> {
    return {
      tools: this.tools,
      hooks: this.hooks,
    };
  }
}

export function createExtension(
  config: ExtensionConfigInput | ExtensionRuntimeConfig,
  dependencies: AdsServiceDependencies = {},
): PiTwinCatAdsExtension {
  const runtimeConfig =
    "services" in config && "maxWaitUntilMs" in config
      ? (config as ExtensionRuntimeConfig)
      : normalizeExtensionConfig(config as ExtensionConfigInput);
  return new PiTwinCatAdsExtensionImpl(runtimeConfig, dependencies);
}

export { normalizeExtensionConfig } from "./config.js";

export {
  AdsService,
  type AdsServiceDependencies,
  type PlcReadResult,
  type PlcStateResult,
  type PlcSymbolSummary,
  type PlcWatchMode,
  type PlcWatchRegistration,
  type PlcWatchSnapshot,
  type PlcWriteAccessResult,
  type PlcWriteMode,
  type PlcWriteModeResult,
} from "./ads/index.js";

export {
  createToolDefinitions,
  type ToolDefinition,
  type ToolExecutionResult,
} from "./tools/index.js";

export { createTwinCatAdsRuntime, type TwinCatAdsRuntime } from "twincat-mcp-core";

export {
  createHookDefinitions,
  type HookDefinition,
  type HookExecutionResult,
} from "./hooks/index.js";

export type {
  AdsConnectionMode,
  AdsDirectConnectionConfig,
  AdsRouterConnectionConfig,
  ExtensionConfigInput,
  ExtensionRuntimeConfig,
  WritePolicy,
} from "./config.js";
