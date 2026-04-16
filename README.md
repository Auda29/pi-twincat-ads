# pi-twincat-ads

Pi extension for reading and writing TwinCAT runtime values over **ADS** (Automation Device Specification).

## Status

The extension scaffold, ADS service, tools, watches, and session hooks are implemented.

Current focus:

- core ADS integration
- safe write gating
- hook-based session lifecycle
- documentation and tests

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

```bash
npm install
npm run build
```

This package is intended to be published as a Pi-installable extension package once the surrounding Pi extension registration layer is finalized.

## Configuration

The runtime configuration is validated with Zod.

### Common fields

- `targetAmsNetId`: target AMS Net ID
- `targetAdsPort`: target ADS port, default `851`
- `readOnly`: default `true`
- `writeAllowlist`: exact symbol names allowed for writes
- `contextSnapshotSymbols`: symbols injected by lifecycle hooks
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

Use direct mode when no local ADS router is available and the client connects directly to the PLC/router endpoint.

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

- An AMS route must exist between client and PLC/router.
- In router mode, the host must have a working ADS router.
- In direct mode, `routerAddress`, `localAmsNetId`, and `localAdsPort` must be configured correctly.
- `targetAdsPort` usually points to a PLC runtime such as `851`.
- Localhost scenarios depend on TwinCAT/router setup and are not assumed automatically.

## Safety Model

Writes are protected by three layers:

1. Config gate: `readOnly`
2. Runtime gate: `plc_set_write_mode`
3. Symbol gate: `writeAllowlist`

Important defaults:

- `readOnly` defaults to `true`
- runtime write mode defaults to `read-only`
- `writeAllowlist` uses exact symbol name matches

That means writes stay blocked until configuration allows them and the runtime mode is explicitly switched to `enabled`.

## Tool Summary

### Read and discovery

- `plc_list_symbols`: list available symbols with metadata
- `plc_read`: read one symbol
- `plc_read_many`: bundled multi-read
- `plc_state`: inspect connection, runtime state, write mode, and watch count

### Write control

- `plc_set_write_mode`: enable or disable session-local write access
- `plc_write`: write a value when all safety gates allow it

### Watches

- `plc_watch`: register or reuse a PLC notification
- `plc_unwatch`: remove a registered watch
- `plc_list_watches`: inspect active session watches

## Hook Behavior

### `session_start`

- connects to ADS
- warms symbol/data type caches
- reads configured snapshot symbols

### `before_agent_start`

- returns a compact startup summary with state, snapshots, and active watches

### `context`

- injects configured snapshot values
- includes current watch count and write mode state

### `tool_call`

- pre-evaluates write access for `plc_write`
- blocks impossible write-mode changes when config keeps `readOnly=true`

### `session_end`

- disconnects ADS
- releases notifications and handles

## Development

Useful commands:

```bash
npm run check
npm run build
npm test
```

## Repository

- **Remote:** [github.com/Auda29/pi-twincat-ads](https://github.com/Auda29/pi-twincat-ads)
- **License:** [MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
