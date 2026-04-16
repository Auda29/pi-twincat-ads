# TwinCAT ADS Skill

Use this skill when the agent needs to inspect or manipulate TwinCAT PLC runtime values over ADS.

## Guidance

- Prefer `plc_state` before attempting writes or watches.
- Use `plc_list_symbols` to discover exact PLC symbol names and types.
- Use `plc_read_many` for related reads when several symbols are needed together.
- Treat `plc_write` as safety-sensitive and only use it for symbols explicitly allowed by configuration.
- Confirm expected machine impact before changing motion, safety, or process-relevant values.

## Symbol Naming

- Expect TwinCAT PLC symbols in forms like `MAIN.varName` or `GVL.Axis[1].Cmd`.
- Prefer exact symbol names from discovery results rather than guessing paths.

## Safety

- Writes are blocked when `readOnly` is enabled.
- Writes outside the configured allowlist must be treated as denied.
- If the PLC is disconnected or in an unexpected state, read and inspect first instead of retrying blind writes.
