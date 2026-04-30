import { z } from "zod";

export const LOOPBACK_AMS_NET_ID = "127.0.0.1.1.1" as const;
export const DEFAULT_PLC_ADS_PORT = 851 as const;
export const DEFAULT_NC_ADS_PORT = 500 as const;
export const DEFAULT_IO_ADS_PORT = 300 as const;
export const DEFAULT_ROUTER_TCP_PORT = 48_898 as const;
export const DEFAULT_LOCAL_ADS_PORT = 32_000 as const;
export const DEFAULT_NOTIFICATION_CYCLE_TIME_MS = 250 as const;
export const DEFAULT_MAX_NOTIFICATIONS = 128 as const;
export const DEFAULT_MAX_WAIT_UNTIL_MS = 120_000 as const;

const amsNetIdSegmentSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(255);

function isLoopbackAlias(value: string): boolean {
  return value.trim().toLowerCase() === "localhost";
}

const amsNetIdSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (isLoopbackAlias(value)) {
      return true;
    }

    const segments = value.split(".");
    if (segments.length !== 6) {
      return false;
    }

    return segments.every((segment) => {
      const parsed = amsNetIdSegmentSchema.safeParse(segment);
      return parsed.success;
    });
  }, 'AMS Net ID must contain six numeric segments between 0 and 255 or use "localhost".')
  .transform((value) =>
    isLoopbackAlias(value) ? LOOPBACK_AMS_NET_ID : value.trim(),
  );

const hostSchema = z
  .string()
  .trim()
  .min(1, "Router address is required.")
  .transform((value) => value.trim());

const adsPortSchema = z
  .number()
  .int()
  .min(1, "ADS port must be greater than zero.")
    .max(65_535, "ADS port must be 65535 or lower.");

const symbolPathSchema = z
  .string()
  .trim()
  .min(1, "Allowlist entries must not be empty.")
  .transform((value) => value.trim());

const plcSymbolGroupsSchema = z
  .record(
    z
      .array(symbolPathSchema)
      .min(1, "PLC symbol groups must contain at least one symbol."),
  )
  .default({});

const adsServiceConfigSchema = z
  .object({
    targetAdsPort: adsPortSchema.optional(),
  })
  .strict();

const plcAdsServiceConfigSchema = adsServiceConfigSchema
  .extend({
    symbolGroups: plcSymbolGroupsSchema,
  })
  .strict();

const adsServicesConfigSchema = z
  .object({
    plc: plcAdsServiceConfigSchema.optional(),
    nc: adsServiceConfigSchema.optional(),
    io: adsServiceConfigSchema.optional(),
  })
  .strict()
  .default({});

const commonConfigSchema = z.object({
  targetAmsNetId: amsNetIdSchema,
  targetAdsPort: adsPortSchema.default(DEFAULT_PLC_ADS_PORT),
  readOnly: z.boolean().default(true),
  writeAllowlist: z.array(symbolPathSchema).default([]),
  contextSnapshotSymbols: z.array(symbolPathSchema).default([]),
  notificationCycleTimeMs: z
    .number()
    .int()
    .min(10, "Notification cycle time must be at least 10 ms.")
    .max(60_000, "Notification cycle time must be 60000 ms or lower.")
    .default(DEFAULT_NOTIFICATION_CYCLE_TIME_MS),
  maxNotifications: z
    .number()
    .int()
    .min(1, "At least one notification slot must be available.")
    .max(550, "Max notifications should stay within Beckhoff ADS limits.")
    .default(DEFAULT_MAX_NOTIFICATIONS),
  maxWaitUntilMs: z
    .number()
    .int()
    .min(1_000, "Max wait-until timeout must be at least 1000 ms.")
    .max(3_600_000, "Max wait-until timeout must be 3600000 ms or lower.")
    .default(DEFAULT_MAX_WAIT_UNTIL_MS),
  services: adsServicesConfigSchema,
});

export const adsRouterConnectionConfigSchema = commonConfigSchema.extend({
  connectionMode: z.literal("router").default("router"),
  routerAddress: z.string().trim().optional(),
  routerTcpPort: z.number().int().optional(),
  localAmsNetId: z.string().trim().optional(),
  localAdsPort: z.number().int().optional(),
});

export const adsDirectConnectionConfigSchema = commonConfigSchema.extend({
  connectionMode: z.literal("direct"),
  routerAddress: hostSchema,
  routerTcpPort: adsPortSchema.default(DEFAULT_ROUTER_TCP_PORT),
  localAmsNetId: amsNetIdSchema,
  localAdsPort: adsPortSchema.default(DEFAULT_LOCAL_ADS_PORT),
});

export const twinCatAdsConfigSchema = z
  .discriminatedUnion("connectionMode", [
    adsRouterConnectionConfigSchema,
    adsDirectConnectionConfigSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.readOnly && value.writeAllowlist.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "writeAllowlist has no effect when readOnly is enabled. Disable readOnly to permit writes.",
        path: ["writeAllowlist"],
      });
    }
  });

export type TwinCatAdsServiceName = "plc" | "nc" | "io";
export interface AdsNamedServiceConfig {
  readonly targetAdsPort: number;
}
export interface PlcAdsNamedServiceConfig extends AdsNamedServiceConfig {
  readonly symbolGroups: Record<string, string[]>;
}
export interface TwinCatAdsServiceConfigs {
  readonly plc: PlcAdsNamedServiceConfig;
  readonly nc: AdsNamedServiceConfig;
  readonly io: AdsNamedServiceConfig;
}

export type AdsConnectionMode = z.infer<
  typeof twinCatAdsConfigSchema
>["connectionMode"];
export type AdsRouterConnectionConfig = z.infer<
  typeof adsRouterConnectionConfigSchema
>;
export type AdsDirectConnectionConfig = z.infer<
  typeof adsDirectConnectionConfigSchema
>;
type ParsedTwinCatAdsRuntimeConfig = z.infer<typeof twinCatAdsConfigSchema>;
export type TwinCatAdsRuntimeConfig = Omit<
  ParsedTwinCatAdsRuntimeConfig,
  "services" | "targetAdsPort"
> & {
  readonly targetAdsPort: number;
  readonly services: TwinCatAdsServiceConfigs;
};
export type TwinCatAdsRouterConfigInput = Omit<
  z.input<typeof adsRouterConnectionConfigSchema>,
  "connectionMode"
> & {
  readonly connectionMode?: "router";
};
export type TwinCatAdsConfigInput =
  | TwinCatAdsRouterConfigInput
  | z.input<typeof adsDirectConnectionConfigSchema>;
export type ExtensionRuntimeConfig = TwinCatAdsRuntimeConfig;
export type ExtensionConfigInput = TwinCatAdsConfigInput;
export type WritePolicy = Pick<
  TwinCatAdsRuntimeConfig,
  "readOnly" | "writeAllowlist"
>;

function normalizeServiceConfigs(
  config: ParsedTwinCatAdsRuntimeConfig,
): TwinCatAdsServiceConfigs {
  const plcTargetAdsPort =
    config.services.plc?.targetAdsPort ?? config.targetAdsPort;

  return {
    plc: {
      targetAdsPort: plcTargetAdsPort,
      symbolGroups: config.services.plc?.symbolGroups ?? {},
    },
    nc: {
      targetAdsPort:
        config.services.nc?.targetAdsPort ?? DEFAULT_NC_ADS_PORT,
    },
    io: {
      targetAdsPort:
        config.services.io?.targetAdsPort ?? DEFAULT_IO_ADS_PORT,
    },
  };
}

export function normalizeTwinCatAdsConfig(
  input: TwinCatAdsConfigInput,
): TwinCatAdsRuntimeConfig {
  const normalizedInput =
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    !("connectionMode" in input)
      ? { ...input, connectionMode: "router" }
      : input;

  const parsed = twinCatAdsConfigSchema.parse(normalizedInput);
  const services = normalizeServiceConfigs(parsed);

  return {
    ...parsed,
    targetAdsPort: services.plc.targetAdsPort,
    services,
  };
}

export function normalizeExtensionConfig(
  input: ExtensionConfigInput,
): ExtensionRuntimeConfig {
  return normalizeTwinCatAdsConfig(input);
}

export function isWriteAllowed(
  config: WritePolicy,
  symbolName: string,
): boolean {
  if (config.readOnly) {
    return false;
  }

  return config.writeAllowlist.includes(symbolName.trim());
}

export { twinCatAdsConfigSchema as extensionConfigSchema };
