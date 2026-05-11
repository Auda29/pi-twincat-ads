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

## Bundled Skills

The package ships skills for agents that support npm-bundled skill discovery:

- `twincat-mcp-ads`: MCP-specific runtime/ADS tool guidance for PLC, NC, IO,
  watches, write gates, connection tools, and TwinCAT runtime diagnostics.
- `twincat-xae-project-guidelines`: agent-neutral guidance for offline TwinCAT
  XAE/Visual Studio project-file work, including PLC project XML, POUs, GVLs,
  DUTs, tasks, I/O devices, boxes, and terminals.

The MCP server provides tools. Skills are agent-side guidance for choosing those
tools, explaining results, and respecting the runtime/project-file safety
boundary.

The XAE skill source lives centrally under
`packages/skills/twincat-xae-project-guidelines`. It is copied into this package
by the MCP `prepack` lifecycle and removed again by `postpack`, so npm artifacts
contain the skill without maintaining a second manual copy.

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
- `TWINCAT_ADS_NOTIFICATION_CYCLE_TIME_MS=250`
- `TWINCAT_ADS_MAX_NOTIFICATIONS=128`
- `TWINCAT_ADS_MAX_WAIT_UNTIL_MS=600000`

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
  "maxNotifications": 128,
  "maxWaitUntilMs": 600000,
  "services": {
    "plc": {
      "targetAdsPort": 851,
      "symbolGroups": {}
    },
    "nc": {
      "targetAdsPort": 500,
      "axes": [
        { "name": "X", "id": 1 }
      ]
    },
    "io": {
      "targetAdsPort": 300,
      "dataPoints": [
        {
          "name": "Input1",
          "indexGroup": 61472,
          "indexOffset": 128000,
          "type": "BOOL"
        }
      ],
      "groups": {
        "inputs": ["Input1"]
      }
    }
  },
  "diagnostics": {
    "maxEvents": 50,
    "maxLogBytes": 65536,
    "eventSources": [
      {
        "id": "local-windows-application",
        "kind": "windowsEventLog",
        "logName": "Application",
        "providerNames": ["TwinCAT", "Beckhoff", "TcSysSrv", "TcSysUi", "TcIoSrv", "TcNc", "TcEvent"],
        "commandTimeoutMs": 8000
      }
    ],
    "logSources": [
      {
        "id": "local-windows-application-log",
        "kind": "windowsEventLog",
        "logName": "Application",
        "providerNames": ["TwinCAT", "Beckhoff", "TcSysSrv", "TcSysUi", "TcIoSrv", "TcNc", "TcEvent"],
        "commandTimeoutMs": 8000
      }
    ]
  }
}
```

## Tools

Connection:

- `ads_connect`
- `ads_disconnect`

PLC reads and state:

- `plc_list_symbols`
- `plc_describe_symbol`
- `plc_read`
- `plc_read_many`
- `plc_list_groups`
- `plc_read_group`
- `plc_state`

`plc_state` includes ADS connection state, write gates, watch count, and a
readable PLC runtime status summary such as `Run` or `Stop`.

NC read-only:

- `nc_state`
- `nc_list_axes`
- `nc_read_axis_position`
- `nc_read_axis_status`
- `nc_read_axis`
- `nc_read_axis_many`
- `nc_read_error`

IO read-only:

- `io_list_groups`
- `io_read`
- `io_read_many`
- `io_read_group`

TwinCAT runtime diagnostics:

- `tc_state`
- `tc_event_list`
- `tc_runtime_error_list`
- `tc_log_read`
- `tc_diagnose_errors`
- `tc_diagnose_runtime`

Diagnostic tools use configured sources under `diagnostics`. The defaults target
the local Windows `Application` Event Log filtered for TwinCAT/Beckhoff entries;
when that API is unavailable, the result reports unavailable capability metadata
instead of failing server startup.

Prefer the individual tools for targeted investigation. Use
`tc_diagnose_errors` for a bounded first look at runtime errors, nearby events,
and log tail; use `tc_diagnose_runtime` for a compact TC/PLC/NC/IO runtime health
summary plus active runtime errors.

Writes and write gates:

- `plc_set_write_mode`
- `plc_get_write_mode`
- `plc_evaluate_write_access`
- `plc_write`

Watches:

- `plc_watch`
- `plc_wait_until`
- `plc_unwatch`
- `plc_list_watches`

Watches are modeled only as tools. They are not MCP resources or
subscriptions yet.

## Safety Model

MCP writes use the same three gates as the core and Pi package:

1. `readOnly=false` in config.
2. `plc_set_write_mode` sets runtime write mode to `enabled`.
3. The exact symbol name is present in `writeAllowlist`.

The default behavior is read-only.

## Development

```bash
npm run sync:skills -w twincat-mcp
npm run test:mcp
npm run build
npm run pack:mcp
```

`npm run pack:mcp` runs the MCP package `prepack`/`postpack` hooks and verifies
that shared skills are present in the package tarball while keeping the
repository source of truth under `packages/skills`.

For package-level checks:

```bash
npm run check -w twincat-mcp
npm run test -w twincat-mcp
```
