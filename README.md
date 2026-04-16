# pi-twincat-ads

Pi extension that gives an agent read/write access to TwinCAT runtime values over **ADS** (Automation Device Specification).

## Status

Early design stage. See [`brainstorm.md`](brainstorm.md) for the planned stack, tools, hooks, and repository layout.

## Planned stack

- TypeScript package installable with `pi install`
- [`ads-client`](https://github.com/jisotalo/ads-client) (Jussi Isotalo) — pure JavaScript ADS client, no native addon
- Pi extension API for tool registration and lifecycle hooks

## Planned capabilities (summary)

| Area | Notes |
|------|--------|
| **Tools** | List symbols, read/write (writes behind allowlist), watch, PLC state, logs |
| **Hooks** | Session start/end, context injection, write gating on `tool_call` |
| **Config** | AMS Net ID, port (e.g. 851), read-only vs allowlist, snapshot symbols, notification cycle |

## Repository

- **Remote:** [github.com/Auda29/pi-twincat-ads](https://github.com/Auda29/pi-twincat-ads)
- **License:** [MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
