import { AdsService, type AdsServiceDependencies } from "./ads/index.js";
import {
  normalizeExtensionConfig,
  type ExtensionConfigInput,
  type ExtensionRuntimeConfig,
} from "./config.js";
import {
  createToolDefinitions,
  type ToolDefinition,
  type ToolHandlerContext,
} from "./tools/index.js";

export interface PiTwinCatAdsExtension {
  readonly name: "pi-twincat-ads";
  readonly config: ExtensionRuntimeConfig;
  readonly adsService: AdsService;
  readonly tools: ToolDefinition<unknown, unknown>[];
  register(): Promise<void>;
}

class PiTwinCatAdsExtensionImpl implements PiTwinCatAdsExtension {
  readonly name = "pi-twincat-ads" as const;
  readonly adsService: AdsService;
  readonly tools: ToolDefinition<unknown, unknown>[];

  constructor(
    readonly config: ExtensionRuntimeConfig,
    dependencies: AdsServiceDependencies = {},
  ) {
    this.adsService = new AdsService(config, dependencies);

    const context: ToolHandlerContext = {
      adsService: this.adsService,
    };

    this.tools = createToolDefinitions().map((tool) => ({
      ...tool,
      execute: (rawInput) => tool.execute(rawInput, context),
    }));
  }

  async register(): Promise<void> {
    // Placeholder for upcoming tasks:
    // tool registration, ADS service bootstrapping, and hook wiring.
  }
}

export function createExtension(
  config: ExtensionConfigInput,
  dependencies: AdsServiceDependencies = {},
): PiTwinCatAdsExtension {
  const runtimeConfig = normalizeExtensionConfig(config);
  return new PiTwinCatAdsExtensionImpl(runtimeConfig, dependencies);
}

export {
  normalizeExtensionConfig,
} from "./config.js";

export {
  AdsService,
  type AdsServiceDependencies,
  type PlcReadResult,
  type PlcStateResult,
  type PlcSymbolSummary,
  type PlcWatchRegistration,
} from "./ads/index.js";

export {
  createToolDefinitions,
  type ToolDefinition,
  type ToolExecutionResult,
} from "./tools/index.js";

export type {
  AdsConnectionMode,
  AdsDirectConnectionConfig,
  AdsRouterConnectionConfig,
  ExtensionConfigInput,
  ExtensionRuntimeConfig,
  WritePolicy,
} from "./config.js";
