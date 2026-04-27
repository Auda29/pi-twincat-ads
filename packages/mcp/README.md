# twincat-mcp

MCP stdio server for TwinCAT ADS PLC operations.

This package exposes `twincat-mcp-core` runtime operations as Model Context
Protocol tools. MCP-specific protocol handling lives here; ADS domain behavior,
configuration validation, watches, and write gates live in `twincat-mcp-core`.

## Install

```bash
npm install -g twincat-mcp
```

Node.js 20 or newer is required.

## Run

```bash
twincat-mcp --config ./plc.config.json
```

Config can also be supplied with environment variables:

- `TWINCAT_ADS_CONFIG='{"connectionMode":"router",...}'`
- `TWINCAT_ADS_TARGET_AMS_NET_ID=192.168.1.120.1.1`
- `TWINCAT_ADS_TARGET_ADS_PORT=851`
- `TWINCAT_ADS_CONNECTION_MODE=router`
- `TWINCAT_ADS_READ_ONLY=true`
- `TWINCAT_ADS_WRITE_ALLOWLIST=MAIN.safeValue,MAIN.otherSafeValue`
- `TWINCAT_ADS_CONTEXT_SNAPSHOT_SYMBOLS=MAIN.someValue`

Direct mode additionally uses:

- `TWINCAT_ADS_ROUTER_ADDRESS`
- `TWINCAT_ADS_ROUTER_TCP_PORT`
- `TWINCAT_ADS_LOCAL_AMS_NET_ID`
- `TWINCAT_ADS_LOCAL_ADS_PORT`

## Example Config

```json
{
  "connectionMode": "router",
  "targetAmsNetId": "192.168.1.120.1.1",
  "targetAdsPort": 851,
  "readOnly": true,
  "writeAllowlist": [],
  "notificationCycleTimeMs": 250,
  "maxNotifications": 128
}
```

## Tools

Connection:

- `ads_connect`
- `ads_disconnect`

PLC reads and state:

- `plc_list_symbols`
- `plc_read`
- `plc_read_many`
- `plc_state`

Writes and write gates:

- `plc_set_write_mode`
- `plc_get_write_mode`
- `plc_evaluate_write_access`
- `plc_write`

Watches:

- `plc_watch`
- `plc_unwatch`
- `plc_list_watches`

In v0.1, watches are modeled only as tools. They are not MCP resources or
subscriptions yet.

## Safety Model

MCP writes use the same three gates as the core and Pi package:

1. `readOnly=false` in config.
2. `plc_set_write_mode` sets runtime write mode to `enabled`.
3. The exact symbol name is present in `writeAllowlist`.

The default behavior is read-only.

## Development

```bash
npm run test:mcp
npm run build
npm run pack:mcp
```

For package-level checks:

```bash
npm run check -w twincat-mcp
npm run test -w twincat-mcp
```
