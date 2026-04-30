# pi-twincat-ads

Pi extension for reading, watching, and safely writing TwinCAT PLC values over
ADS.

This package is the Pi adapter for the monorepo. ADS logic is provided by
`twincat-mcp-core`; this package owns Pi extension registration, tool wrappers,
lifecycle hooks, context injection, and the bundled skill.

## Install

```bash
pi install npm:pi-twincat-ads
```

The prerelease channel can be installed explicitly with:

```bash
pi install npm:pi-twincat-ads@next
```

The package manifest registers:

- extension entry: `./dist/pi-extension.js`
- skill directory: `./skills`

## Configuration

The Pi adapter accepts configuration through:

- `--plc-config ./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG=./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG_JSON='{"connectionMode":"router",...}'`

Default local config:

```json
{
  "connectionMode": "router",
  "targetAmsNetId": "localhost",
  "targetAdsPort": 851,
  "readOnly": true,
  "writeAllowlist": [],
  "contextSnapshotSymbols": [],
  "notificationCycleTimeMs": 250,
  "maxNotifications": 128,
  "maxWaitUntilMs": 120000,
  "services": {
    "plc": {
      "targetAdsPort": 851,
      "symbolGroups": {}
    },
    "nc": {
      "targetAdsPort": 500
    },
    "io": {
      "targetAdsPort": 300
    }
  }
}
```

For direct mode, include `routerAddress`, `routerTcpPort`, `localAmsNetId`, and
`localAdsPort`.

## Tools

Read and discovery:

- `plc_list_symbols`
- `plc_describe_symbol`
- `plc_read`
- `plc_read_many`
- `plc_list_groups`
- `plc_read_group`
- `plc_state`

Write control:

- `plc_set_write_mode`
- `plc_write`

Watches:

- `plc_watch`
- `plc_wait_until`
- `plc_unwatch`
- `plc_list_watches`

All tool operations delegate to `twincat-mcp-core`.

## Hooks

- `session_start`: connects and reads configured snapshot symbols
- `before_agent_start`: returns startup state, snapshots, failed snapshots, and watches
- `context`: injects live snapshots, failed snapshot names, watch count, and write mode
- `tool_call`: pre-evaluates write access for write-related tools
- `session_end`: disconnects and releases ADS resources

In packaged Pi usage, `session_shutdown` maps to the internal `session_end`
cleanup.

## Safety Model

Writes require all gates to pass:

1. `readOnly=false` in config.
2. `plc_set_write_mode` has switched runtime write mode to `enabled`.
3. The exact symbol name is present in `writeAllowlist`.

The default behavior is read-only.

## Local Smoke Test

Build the workspace and run the root smoke script against a reachable PLC:

```bash
npm run build
npm run smoke:local -- --config ./local.config.json --symbol MAIN.someValue --watch-symbol MAIN.someValue
```

Optional write smoke:

```bash
npm run smoke:local -- --config ./local.config.json --symbol MAIN.someValue --watch-symbol MAIN.someValue --enable-write --write-symbol MAIN.safeWriteValue --write-value 1
```

Only run the write path against a safe symbol with `readOnly=false` and a matching
`writeAllowlist` entry.

## Migration Notes

Existing `pi-twincat-ads` users keep installing the same package name. The main
behavioral change is package structure: ADS service and config logic now live in
`twincat-mcp-core`, while Pi-specific hooks and tools remain here.

The old single-package `src/ads` and `src/config` imports are preserved as
compatibility re-exports for now, but new code should import core primitives
from `twincat-mcp-core`.

## Development

```bash
npm run test:pi
npm run build
npm run pack:pi
```

Live PLC smoke-test details are documented in the repository under
`docs/local-dev-test.md` and `docs/manual-smoke-test.md`.
