export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
}

export function createToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "plc_list_symbols",
      description: "List available PLC symbols with metadata.",
    },
    {
      name: "plc_read",
      description: "Read a PLC symbol by name.",
    },
    {
      name: "plc_read_many",
      description: "Read multiple PLC symbols using a bundled ADS request.",
    },
    {
      name: "plc_write",
      description: "Write a PLC symbol when the write policy permits it.",
    },
    {
      name: "plc_watch",
      description: "Register a PLC notification watch for a symbol.",
    },
    {
      name: "plc_state",
      description: "Inspect TwinCAT runtime and ADS connection state.",
    },
    {
      name: "plc_log",
      description: "Read PLC log or event logger information when available.",
    },
  ];
}
