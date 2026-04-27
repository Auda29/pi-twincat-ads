---
name: twincat-ads
description: >-
  TwinCAT ADS via pi-twincat-ads (plc_state, plc_list_symbols, plc_read, plc_write,
  plc_watch). Use when inspecting or changing TwinCAT PLC symbols, runtime state,
  or ADS watches over a configured ADS connection.
---

# TwinCAT ADS Skill

Use this skill when the agent needs to inspect or manipulate TwinCAT PLC runtime values over ADS.

## Recommended workflow

1. Start with `plc_state`.
2. Use `plc_list_symbols` if the exact symbol path is not certain.
3. Use `plc_read` or `plc_read_many` before making decisions.
4. Only use `plc_write` after checking state, symbol path, and write permissions.
5. Use `plc_watch` for ongoing observation and `plc_list_watches` to inspect current subscriptions.
6. Pay attention to hook-provided `failedSnapshots` if configured context symbols could not be read.

## Tool guidance

### Discovery and reads

- Prefer `plc_list_symbols` for discovery.
- Prefer `plc_read_many` when several related values are needed together.
- Use `plc_state` to understand runtime mode, watch count, and current write availability.
- If hooks return `failedSnapshots`, treat that as a configuration or PLC-symbol drift hint and verify the symbol names.

### Finding symbol paths

- Users often describe a variable by meaning, not by its full ADS symbol path.
- If the user says something like "check variable `xEnable` in block `FB_Axis`", do not guess the final path immediately.
- First search with `plc_list_symbols` using narrow filters based on the most specific pieces you have:
  - variable name such as `xEnable`
  - block or DUT name such as `FB_Axis`
  - program or GVL name if mentioned, such as `MAIN` or `GVL`
- Prefer refining in small steps instead of using a very broad filter once.
- Once matching symbols are listed, use the exact returned symbol path for `plc_read`, `plc_read_many`, `plc_watch`, or `plc_write`.

Example workflow:

- User says: "Check the value of variable `xResetLog` in the block `PRG_SPS_Ablauf_Anl1`."
- First try `plc_list_symbols` with a filter like `xResetLog`.
- If there are many matches, refine with `PRG_SPS_Ablauf_Anl1`.
- A returned symbol might be `PRG_SPS_Ablauf_Anl1.L_xResetLog` or `PRG_SPS_Ablauf_Anl1.fbLogger.xResetLog`.
- Then use that exact full path in `plc_read`.

Heuristics for common TwinCAT naming:

- Top-level program variables often look like `MAIN.someValue` or `PRG_Name.someValue`.
- Global variables often start with a GVL name such as `GVL_System.someValue`.
- Nested function block members often look like `MAIN.fbAxis.xEnable` or `PRG_Name.fbUnit.stStatus.xReady`.
- Array elements can appear as `GVL.Axis[1].Cmd`.
- Exact casing matters, especially for writes and allowlists.

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
- A fresh watch can already expose an initial `lastValue` and `lastTimestamp` when ADS provides `latestData`.
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
