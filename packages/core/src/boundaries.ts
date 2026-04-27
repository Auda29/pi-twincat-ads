export const CORE_RESPONSIBILITIES = [
  "TwinCAT ADS configuration and validation",
  "ADS service contracts and domain result types",
  "runtime write-mode and write-allowlist safety model",
  "transport-free PLC operations",
  "watch lifecycle contracts",
] as const;

export const OUT_OF_CORE_RESPONSIBILITIES = [
  "Pi extension registration, flags, hooks, UI status, and prompt/context injection",
  "MCP stdio server setup, tool registration, and JSON-RPC protocol handling",
  "package-specific skill files and agent-facing usage guidance",
] as const;

export type CoreResponsibility = (typeof CORE_RESPONSIBILITIES)[number];
export type OutOfCoreResponsibility =
  (typeof OUT_OF_CORE_RESPONSIBILITIES)[number];
