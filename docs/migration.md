# Migration From `pi-twincat-ads`

The project has moved from a single Pi package to the `twincat-mcp` monorepo
with shared Core, Pi, and MCP packages.

## Package Mapping

| Old location | New package | Notes |
| --- | --- | --- |
| `pi-twincat-ads` ADS service/config internals | `twincat-mcp-core` | Transport-agnostic ADS logic and safety model |
| `pi-twincat-ads` Pi extension entry | `pi-twincat-ads` | Same package name for Pi users |
| MCP server support | `twincat-mcp` | New stdio server package |

## Existing Pi Users

Keep installing the Pi package:

```bash
pi install npm:pi-twincat-ads
```

The Pi package still exposes the Pi extension and bundled skill. It now uses
`twincat-mcp-core` internally for ADS behavior.

Config remains compatible with the shared core schema:

```json
{
  "connectionMode": "router",
  "targetAmsNetId": "localhost",
  "targetAdsPort": 851,
  "readOnly": true,
  "writeAllowlist": [],
  "contextSnapshotSymbols": [],
  "notificationCycleTimeMs": 250,
  "maxNotifications": 128
}
```

Pi still accepts:

- `--plc-config ./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG=./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG_JSON='{"connectionMode":"router",...}'`

## Import Changes

Old Pi-adapter imports continue to exist as compatibility re-exports where they
are still needed by local code:

```ts
import { AdsService } from "pi-twincat-ads";
```

New shared runtime code should import from Core:

```ts
import {
  AdsService,
  createTwinCatAdsRuntime,
  normalizeTwinCatAdsConfig,
} from "twincat-mcp-core";
```

Pi adapter code should use the Core runtime boundary instead of direct
`AdsService` methods when implementing tools or hooks.

## Tool Changes

The current Pi package exposes:

- `plc_list_symbols`
- `plc_describe_symbol`
- `plc_read`
- `plc_read_many`
- `plc_list_groups`
- `plc_read_group`
- `plc_state`
- `plc_set_write_mode`
- `plc_write`
- `plc_watch`
- `plc_wait_until`
- `plc_unwatch`
- `plc_list_watches`
- `nc_state`
- `nc_list_axes`
- `nc_read_axis`
- `nc_read_axis_many`
- `nc_read_error`
- `io_list_groups`
- `io_read`
- `io_read_many`
- `io_read_group`
- `tc_state`
- `tc_event_list`
- `tc_runtime_error_list`
- `tc_log_read`

`plc_set_target` is not part of the current monorepo adapter API. Change target
configuration by editing the config file or environment used to start Pi.

## Safety Model

The write safety model is unchanged in spirit and now lives in Core:

1. `readOnly` must be `false`.
2. Runtime write mode must be `enabled`.
3. The exact symbol name must be listed in `writeAllowlist`.

The default remains read-only.

## Local Verification

From the repository root:

```bash
npm run check
npm test
npm run build
npm run pack:dry-run
```

Run a live Pi-style PLC smoke test:

```bash
npm run smoke:local -- --config ./local.config.json --symbol MAIN.someValue --watch-symbol MAIN.someValue
```

Run the MCP package tests:

```bash
npm run test:mcp
```

## Publishing Notes

Publish Core before packages that depend on it:

1. `twincat-mcp-core`
2. `pi-twincat-ads`
3. `twincat-mcp`

Source manifests keep internal dependencies on the matching released package
version so local npm installs and published tarballs use the same dependency
shape.
