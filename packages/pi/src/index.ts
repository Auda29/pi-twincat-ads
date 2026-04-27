import { AdsService, type AdsServiceDependencies } from "./ads/index.js";
import { createTwinCatAdsRuntime, type TwinCatAdsRuntime } from "twincat-ads-core";
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
  type ToolHandlerContext,
} from "./tools/index.js";

export interface ExtensionRegistration {
  readonly tools: ToolDefinition<unknown, unknown>[];
  readonly hooks: HookDefinition<unknown, unknown>[];
}

export interface PiTwinCatAdsExtension {
  readonly name: "pi-twincat-ads";
  readonly config: ExtensionRuntimeConfig;
  readonly adsService: AdsService;
  readonly runtime: TwinCatAdsRuntime;
  readonly tools: ToolDefinition<unknown, unknown>[];
  readonly hooks: HookDefinition<unknown, unknown>[];
  register(): Promise<ExtensionRegistration>;
}

class PiTwinCatAdsExtensionImpl implements PiTwinCatAdsExtension {
  readonly name = "pi-twincat-ads" as const;
  readonly adsService: AdsService;
  readonly runtime: TwinCatAdsRuntime;
  readonly tools: ToolDefinition<unknown, unknown>[];
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

    this.tools = createToolDefinitions().map((tool) => ({
      ...tool,
      execute: (rawInput) => tool.execute(rawInput, toolContext),
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
  config: ExtensionConfigInput,
  dependencies: AdsServiceDependencies = {},
): PiTwinCatAdsExtension {
  const runtimeConfig = normalizeExtensionConfig(config);
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

export { createTwinCatAdsRuntime, type TwinCatAdsRuntime } from "twincat-ads-core";

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
