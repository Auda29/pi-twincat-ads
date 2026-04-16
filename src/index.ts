import {
  normalizeExtensionConfig,
  type ExtensionConfigInput,
  type ExtensionRuntimeConfig,
} from "./config.js";

export interface PiTwinCatAdsExtension {
  readonly name: "pi-twincat-ads";
  readonly config: ExtensionRuntimeConfig;
  register(): Promise<void>;
}

class PiTwinCatAdsExtensionImpl implements PiTwinCatAdsExtension {
  readonly name = "pi-twincat-ads" as const;

  constructor(readonly config: ExtensionRuntimeConfig) {}

  async register(): Promise<void> {
    // Placeholder for upcoming tasks:
    // tool registration, ADS service bootstrapping, and hook wiring.
  }
}

export function createExtension(
  config: ExtensionConfigInput,
): PiTwinCatAdsExtension {
  const runtimeConfig = normalizeExtensionConfig(config);
  return new PiTwinCatAdsExtensionImpl(runtimeConfig);
}

export {
  normalizeExtensionConfig,
  type AdsConnectionMode,
  type AdsDirectConnectionConfig,
  type AdsRouterConnectionConfig,
  type ExtensionConfigInput,
  type ExtensionRuntimeConfig,
  type WritePolicy,
} from "./config.js";
