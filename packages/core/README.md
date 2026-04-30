# twincat-mcp-core

Transport-agnostic TwinCAT ADS runtime for Node.js.

The core package owns the ADS domain logic used by both `pi-twincat-ads` and
`twincat-mcp`: configuration validation, `AdsService`, runtime operations,
symbol/data-type caching, watches, reconnect handling, and the write-safety
model.

## Install

```bash
npm install twincat-mcp-core
```

Node.js 20 or newer is required.

## Runtime API

```ts
import {
  AdsService,
  createTwinCatAdsRuntime,
  normalizeTwinCatAdsConfig,
} from "twincat-mcp-core";

const config = normalizeTwinCatAdsConfig({
  connectionMode: "router",
  targetAmsNetId: "localhost",
  readOnly: true,
  services: {
    plc: {
      targetAdsPort: 851,
      symbolGroups: {
        machine: ["MAIN.State", "MAIN.Mode"],
      },
    },
  },
});

const service = new AdsService(config);
const runtime = createTwinCatAdsRuntime(service, { config });

await runtime.connect();
const state = await runtime.readState();
const value = await runtime.readSymbol({ name: "MAIN.someValue" });
await runtime.disconnect();
```

## Operations

The runtime exposes transport-free PLC operations:

- `connect`
- `disconnect`
- `listSymbols`
- `describeSymbol`
- `readSymbol`
- `readMany`
- `listGroups`
- `readGroup`
- `writeSymbol`
- `watchSymbol`
- `waitUntil`
- `unwatchSymbol`
- `listWatches`
- `readState`
- `setWriteMode`
- `getWriteModeState`
- `evaluateWriteAccess`

Adapters should call these runtime operations instead of reaching through to
low-level ADS client APIs.

## Configuration

Config is validated with Zod and normalized by `normalizeTwinCatAdsConfig`.

Router mode:

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

Direct mode:

```json
{
  "connectionMode": "direct",
  "targetAmsNetId": "192.168.1.120.1.1",
  "targetAdsPort": 851,
  "routerAddress": "192.168.1.120",
  "routerTcpPort": 48898,
  "localAmsNetId": "192.168.1.50.1.1",
  "localAdsPort": 32000,
  "readOnly": true,
  "writeAllowlist": [],
  "services": {
    "plc": {
      "targetAdsPort": 851,
      "symbolGroups": {
        "machine": ["MAIN.State", "MAIN.Mode"]
      }
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

`services.plc.targetAdsPort` is the effective PLC ADS port when present. The
top-level `targetAdsPort` remains accepted for compatibility. `services.nc` and
`services.io` configure reusable ADS clients for NC and IO service layers.
Configured PLC `symbolGroups` can be listed with `listGroups` and read with
`readGroup`.

## Safety Model

Writes are blocked unless:

1. `readOnly` is `false`.
2. Runtime write mode is `enabled`.
3. The exact symbol name is present in `writeAllowlist`.

`writeSymbol` throws `WriteDeniedError` when the gates reject a write.

## Package Boundary

Core intentionally does not own:

- Pi extension registration
- Pi hooks or context injection
- Pi skills
- MCP stdio transport
- MCP JSON-RPC handling
- MCP tool registration

Those live in the adapter packages.

## Development

```bash
npm run check -w twincat-mcp-core
npm run test -w twincat-mcp-core
npm run build -w twincat-mcp-core
```
