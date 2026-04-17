import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  normalizeExtensionConfig,
  type ExtensionConfigInput,
  type ExtensionRuntimeConfig,
} from "./config.js";

export const DEFAULT_PLC_CONFIG_FILENAME = "plc.config.json" as const;

export interface ResolvePiConfigOptions {
  readonly cwd?: string;
  readonly flagValue?: string;
  readonly envPath?: string;
  readonly envJson?: string;
}

export interface ResolvedPiConfig {
  readonly config: ExtensionRuntimeConfig;
  readonly configPath?: string;
  readonly source:
    | "flag-path"
    | "flag-json"
    | "env-path"
    | "env-json"
    | "default-path";
  readonly createdDefaultConfig: boolean;
}

export interface PersistTargetConfigUpdateOptions {
  readonly configPath: string;
  readonly targetAmsNetId: string;
  readonly targetAdsPort?: number;
}

export function createDefaultPiConfig(): ExtensionConfigInput {
  return {
    connectionMode: "router",
    targetAmsNetId: "localhost",
    targetAdsPort: 851,
    readOnly: true,
    writeAllowlist: [],
    contextSnapshotSymbols: [],
    notificationCycleTimeMs: 250,
    maxNotifications: 128,
  };
}

async function readJsonConfig(configPath: string): Promise<ExtensionConfigInput> {
  const fileContent = await readFile(configPath, "utf8");
  return JSON.parse(fileContent) as ExtensionConfigInput;
}

async function ensureDefaultConfigFile(
  configPath: string,
): Promise<{ config: ExtensionConfigInput; created: boolean }> {
  try {
    await access(configPath);
    return {
      config: await readJsonConfig(configPath),
      created: false,
    };
  } catch {
    const config = createDefaultPiConfig();
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    return {
      config,
      created: true,
    };
  }
}

export async function resolvePiConfig(
  options: ResolvePiConfigOptions = {},
): Promise<ResolvedPiConfig> {
  const cwd = options.cwd ?? process.cwd();
  const flagValue = options.flagValue?.trim();

  if (flagValue) {
    if (flagValue.startsWith("{")) {
      return {
        config: normalizeExtensionConfig(
          JSON.parse(flagValue) as ExtensionConfigInput,
        ),
        source: "flag-json",
        createdDefaultConfig: false,
      };
    }

    const configPath = path.resolve(cwd, flagValue);
    return {
      config: normalizeExtensionConfig(await readJsonConfig(configPath)),
      configPath,
      source: "flag-path",
      createdDefaultConfig: false,
    };
  }

  const envPath = options.envPath?.trim();
  if (envPath) {
    const configPath = path.resolve(cwd, envPath);
    return {
      config: normalizeExtensionConfig(await readJsonConfig(configPath)),
      configPath,
      source: "env-path",
      createdDefaultConfig: false,
    };
  }

  const envJson = options.envJson?.trim();
  if (envJson) {
    return {
      config: normalizeExtensionConfig(
        JSON.parse(envJson) as ExtensionConfigInput,
      ),
      source: "env-json",
      createdDefaultConfig: false,
    };
  }

  const configPath = path.resolve(cwd, DEFAULT_PLC_CONFIG_FILENAME);
  const ensured = await ensureDefaultConfigFile(configPath);

  return {
    config: normalizeExtensionConfig(ensured.config),
    configPath,
    source: "default-path",
    createdDefaultConfig: ensured.created,
  };
}

export async function persistTargetConfigUpdate(
  options: PersistTargetConfigUpdateOptions,
): Promise<ExtensionRuntimeConfig> {
  const currentConfig = await readJsonConfig(options.configPath);
  const nextConfig: ExtensionConfigInput = {
    ...currentConfig,
    targetAmsNetId: options.targetAmsNetId,
  };

  if (options.targetAdsPort !== undefined) {
    nextConfig.targetAdsPort = options.targetAdsPort;
  }

  const normalizedConfig = normalizeExtensionConfig(nextConfig);
  await writeFile(
    options.configPath,
    `${JSON.stringify(nextConfig, null, 2)}\n`,
    "utf8",
  );

  return normalizedConfig;
}
