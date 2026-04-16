export interface HookRegistration {
  readonly name: string;
  readonly description: string;
}

export function createHookDefinitions(): HookRegistration[] {
  return [
    {
      name: "session_start",
      description: "Open ADS connection and hydrate caches.",
    },
    {
      name: "before_agent_start",
      description: "Inject a compact startup snapshot for the PLC.",
    },
    {
      name: "context",
      description: "Inject live PLC context for configured snapshot symbols.",
    },
    {
      name: "tool_call",
      description: "Enforce write policy before PLC mutations execute.",
    },
    {
      name: "session_end",
      description: "Release notifications, handles, and the ADS connection.",
    },
  ];
}
