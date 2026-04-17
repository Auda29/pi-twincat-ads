import { z } from "zod";

export const LOOPBACK_AMS_NET_ID = "127.0.0.1.1.1" as const;

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
  .max(65535, "ADS port must be 65535 or lower.");

const symbolPathSchema = z
  .string()
  .trim()
  .min(1, "Allowlist entries must not be empty.")
  .transform((value) => value.trim());

const commonConfigSchema = z.object({
  targetAmsNetId: amsNetIdSchema,
  targetAdsPort: adsPortSchema.default(851),
  readOnly: z.boolean().default(true),
  writeAllowlist: z.array(symbolPathSchema).default([]),
  contextSnapshotSymbols: z.array(symbolPathSchema).default([]),
  notificationCycleTimeMs: z
    .number()
    .int()
    .min(10, "Notification cycle time must be at least 10 ms.")
    .max(60_000, "Notification cycle time must be 60000 ms or lower.")
    .default(250),
  maxNotifications: z
    .number()
    .int()
    .min(1, "At least one notification slot must be available.")
    .max(550, "Max notifications should stay within Beckhoff ADS limits.")
    .default(128),
});

const routerModeSchema = commonConfigSchema.extend({
  connectionMode: z.literal("router").default("router"),
  routerAddress: z.string().trim().optional(),
  routerTcpPort: z.number().int().optional(),
  localAmsNetId: z.string().trim().optional(),
  localAdsPort: z.number().int().optional(),
});

const directModeSchema = commonConfigSchema.extend({
  connectionMode: z.literal("direct"),
  routerAddress: hostSchema,
  routerTcpPort: adsPortSchema.default(48898),
  localAmsNetId: amsNetIdSchema,
  localAdsPort: adsPortSchema.default(32_000),
});

const extensionConfigSchema = z
  .discriminatedUnion("connectionMode", [routerModeSchema, directModeSchema])
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

export type AdsConnectionMode = z.infer<
  typeof extensionConfigSchema
>["connectionMode"];
export type AdsRouterConnectionConfig = z.infer<typeof routerModeSchema>;
export type AdsDirectConnectionConfig = z.infer<typeof directModeSchema>;
export type ExtensionRuntimeConfig = z.infer<typeof extensionConfigSchema>;
export type ExtensionConfigInput = z.input<typeof extensionConfigSchema>;
export type WritePolicy = Pick<
  ExtensionRuntimeConfig,
  "readOnly" | "writeAllowlist"
>;

export function normalizeExtensionConfig(
  input: ExtensionConfigInput,
): ExtensionRuntimeConfig {
  return extensionConfigSchema.parse(input);
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

export { extensionConfigSchema };
