# pi-twincat-ads

Pi extension for reading and writing TwinCAT runtime values over ADS.

## Status

The extension is implemented and currently includes:

- an ADS service with connection management, reconnect handling, symbol and handle caches
- read, watch, and write tools with schema validation
- hook-based session lifecycle integration
- a three-layer write safety model
- automated tests and a manual smoke-test guide

## Features

### Tools

- `plc_list_symbols`
- `plc_read`
- `plc_read_many`
- `plc_state`
- `plc_set_write_mode`
- `plc_write`
- `plc_watch`
- `plc_unwatch`
- `plc_list_watches`

### Hooks

- `session_start`
- `before_agent_start`
- `context`
- `tool_call`
- `session_end`

## Installation

### As a Pi package

Build and publish or pack the package, then install it into Pi:

```bash
pi install npm:pi-twincat-ads
```

The package ships a Pi manifest in `package.json` and registers:

- the extension entry at `./dist/pi-extension.js`
- the bundled skill directory at `./skills`

Pi discovers the extension from the manifest and loads it automatically.

### For local development

```bash
npm install
npm run build
```

The package also exports `createExtension()` for direct local/dev integration outside a Pi host.

## Configuration

Runtime configuration is validated with Zod.

### Pi runtime config

The Pi adapter expects one of these inputs at startup:

- `--plc-config ./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG=./plc.config.json`
- `PI_TWINCAT_ADS_CONFIG_JSON='{"connectionMode":"router",...}'`

Typical Pi launch pattern:

```bash
pi --plc-config ./plc.config.json
```

Example `plc.config.json`:

```json
{
  "connectionMode": "router",
  "targetAmsNetId": "192.168.1.120.1.1",
  "targetAdsPort": 851,
  "readOnly": true,
  "contextSnapshotSymbols": [
    "MAIN.someValue"
  ]
}
```

### Common fields

- `targetAmsNetId`: target AMS Net ID
- `targetAdsPort`: target ADS port, default `851`
- `readOnly`: default `true`
- `writeAllowlist`: exact symbol names allowed for writes
- `contextSnapshotSymbols`: symbols read by lifecycle hooks for agent context
- `notificationCycleTimeMs`: default notification cycle time, default `250`
- `maxNotifications`: local notification cap, default `128`

### Router mode

Use router mode when the host already has a compatible ADS router.

```ts
{
  connectionMode: "router",
  targetAmsNetId: "192.168.1.120.1.1",
  targetAdsPort: 851,
  readOnly: true
}
```

Optional router-mode fields:

- `routerAddress`
- `routerTcpPort`
- `localAmsNetId`
- `localAdsPort`

### Direct mode

Use direct mode when no local ADS router is available and the client connects directly to the PLC or router endpoint.

```ts
{
  connectionMode: "direct",
  targetAmsNetId: "192.168.1.120.1.1",
  targetAdsPort: 851,
  routerAddress: "192.168.1.120",
  routerTcpPort: 48898,
  localAmsNetId: "192.168.1.50.1.1",
  localAdsPort: 32000,
  readOnly: true
}
```

## ADS Prerequisites

- An AMS route must exist between client and PLC or router.
- In router mode, the host must have a working ADS router.
- In direct mode, `routerAddress`, `localAmsNetId`, and `localAdsPort` must be configured correctly.
- `targetAdsPort` usually points to a PLC runtime such as `851`.
- Localhost scenarios depend on TwinCAT and router setup and are not assumed automatically.

## Safety Model

Writes are protected by three layers:

1. Config gate: `readOnly`
2. Runtime gate: `plc_set_write_mode`
3. Symbol gate: `writeAllowlist`

Important defaults:

- `readOnly` defaults to `true`
- runtime write mode defaults to `read-only`
- `writeAllowlist` uses exact, case-sensitive symbol name matches

That means writes stay blocked until configuration allows them, the session-local write mode is explicitly switched to `enabled`, and the symbol is allowlisted.

## Tool Summary

### Read and discovery

- `plc_list_symbols`: list available symbols with metadata
- `plc_read`: read one symbol
- `plc_read_many`: bundled multi-read using ADS raw multi-read
- `plc_state`: inspect connection state, PLC runtime state, write mode, write policy, and watch count

### Write control

- `plc_set_write_mode`: enable or disable session-local write access
- `plc_write`: write a value when all safety gates allow it

### Watches

- `plc_watch`: register or reuse a PLC notification
- `plc_unwatch`: remove a registered watch idempotently
- `plc_list_watches`: inspect active session watches

Watches keep local metadata such as mode, cycle time, notification handle, and the latest received value and timestamp. Initial `latestData` from ADS is preserved when available, and reconnect handling rebinds active watches automatically.

## Hook Behavior

In the packaged Pi adapter, the internal hooks are bound to real Pi lifecycle events.

### `session_start`

- connects to ADS
- warms symbol and data type caches
- reads configured snapshot symbols
- returns `failedSnapshots` for symbols that could not be read

### `before_agent_start`

- returns a compact startup summary with state, snapshots, failed snapshots, and active watches

### `context`

- injects configured snapshot values
- includes `failedSnapshots`, current watch count, and write mode state

### `tool_call`

- pre-evaluates write access for `plc_write`
- blocks enabling runtime writes when config keeps `readOnly=true`
- leaves defensive `plc_set_write_mode("read-only")` calls allowed

### `session_end`

- disconnects ADS
- releases notifications, handles, and connection state

In Pi this cleanup is triggered from `session_shutdown`.

## Verification

Useful commands:

```bash
npm run check
npm run build
npm test
```

The current automated suite covers config validation, connection deduplication, write gates, handle caching, watch lifecycle, reconnect rebinds, tool behavior, and hook behavior. For live verification against a PLC, see [docs/manual-smoke-test.md](docs/manual-smoke-test.md).

For a direct local PLC test without a Pi host instance, see [docs/local-dev-test.md](docs/local-dev-test.md).

## Repository

- **Remote:** [github.com/Auda29/pi-twincat-ads](https://github.com/Auda29/pi-twincat-ads)
- **License:** [MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
