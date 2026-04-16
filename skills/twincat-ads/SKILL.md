# TwinCAT ADS Skill

Use this skill when the agent needs to inspect or manipulate TwinCAT PLC runtime values over ADS.

## Recommended workflow

1. Start with `plc_state`.
2. Use `plc_list_symbols` if the exact symbol path is not certain.
3. Use `plc_read` or `plc_read_many` before making decisions.
4. Only use `plc_write` after checking state, symbol path, and write permissions.
5. Use `plc_watch` for ongoing observation and `plc_list_watches` to inspect current subscriptions.

## Tool guidance

### Discovery and reads

- Prefer `plc_list_symbols` for discovery.
- Prefer `plc_read_many` when several related values are needed together.
- Use `plc_state` to understand runtime mode, watch count, and current write availability.

### Writes

- Treat every write as safety-sensitive.
- Writes are blocked unless all of the following are true:
  - config `readOnly` is `false`
  - runtime write mode was explicitly enabled with `plc_set_write_mode`
  - the symbol is in `writeAllowlist`
- If a write is denied, inspect `plc_state` and the symbol name before retrying.

### Watches

- Use `plc_watch` when repeated polling would be wasteful.
- Default watch behavior is `on-change`.
- Use `plc_unwatch` when the observation is no longer needed.
- Use `plc_list_watches` before creating duplicate observation plans.

## Symbol naming

- Expect TwinCAT PLC symbols in forms like `MAIN.varName`, `GVL.Axis[1].Cmd`, or nested DUT paths.
- Prefer exact symbol names returned by discovery instead of guessing.
- Write allowlist matching is exact and case-sensitive.

## Safety rules

- Do not assume write access just because `plc_write` exists.
- Do not enable runtime writes unless there is a clear operational reason.
- Read machine-relevant state before changing motion, process, or safety-adjacent values.
- If PLC state looks unexpected, stop and inspect rather than retrying writes aggressively.
