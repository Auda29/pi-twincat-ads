# twincat-ads-core

Transport-agnostic TwinCAT ADS domain package.

The core owns configuration validation, ADS service contracts, runtime/controller operations, watches, and the three-layer write-safety model:

- config `readOnly`
- runtime write mode
- exact `writeAllowlist`

Pi-specific registration, hooks, prompt/context injection, UI status, and skills stay in `pi-twincat-ads`.

MCP-specific stdio setup, JSON-RPC handling, and MCP tool registration stay in `twincat-ads-mcp`.
