---
name: twincat-mcp-ads
description: >-
  TwinCAT ADS runtime guidance for the twincat-mcp MCP server. Use when an
  agent works with MCP tools such as ads_connect, plc_state, plc_list_symbols,
  plc_describe_symbol, plc_read, plc_read_many, plc_list_groups,
  plc_read_group, plc_set_write_mode, plc_get_write_mode,
  plc_evaluate_write_access, plc_write, plc_watch, plc_wait_until, nc_state,
  nc_list_axes, nc_read_axis_position, nc_read_axis_status, nc_read_axis,
  nc_read_axis_many, nc_read_error, io_list_groups, io_read, io_read_many,
  io_read_group, tc_state, tc_event_list, tc_runtime_error_list, tc_log_read,
  tc_diagnose_errors, or tc_diagnose_runtime.
---

# TwinCAT MCP ADS Skill

Use this skill when the MCP server exposes TwinCAT runtime values, diagnostics,
watches, waits, or explicitly gated PLC writes over ADS. The MCP server provides
tools; this skill only guides agent-side tool selection, wording, and safety.

For offline TwinCAT XAE or Visual Studio project-file work, use
`twincat-xae-project-guidelines` instead. Keep runtime ADS observations separate
from project-tree, POU, GVL, DUT, task, I/O topology, build, and XAE editing
work.

## Recommended Workflow

1. Start with `ads_connect` when the server is not already connected, then use
   `plc_state` or `tc_state` to verify runtime state and write gates.
2. Use `plc_list_symbols` when the exact PLC symbol path is uncertain.
3. Use `plc_describe_symbol` when type, size, array bounds, or struct members
   matter before a read or write.
4. Use `plc_read_many`, `plc_list_groups`, and `plc_read_group` for related PLC
   snapshots.
5. Use `nc_state`, `nc_list_axes`, `nc_read_axis_position`,
   `nc_read_axis_status`, `nc_read_axis`, or `nc_read_error` for NC axes.
6. Use `io_list_groups`, `io_read`, `io_read_many`, or `io_read_group` for
   configured IO process data points.
7. Use `tc_state`, `tc_event_list`, `tc_runtime_error_list`, `tc_log_read`,
   `tc_diagnose_errors`, or `tc_diagnose_runtime` for TwinCAT runtime
   diagnostics.
8. Use `plc_wait_until` for a bounded condition wait and `plc_watch` for ongoing
   observation. Use `plc_list_watches` before creating duplicate watches.
9. For writes, call `plc_evaluate_write_access` first when there is any doubt.
   Only use `plc_write` after checking runtime state, exact symbol path, and all
   write gates.
10. Use `ads_disconnect` when a session explicitly needs to close the ADS
    connection.

## Runtime Scope

- These MCP tools inspect live TwinCAT runtime state over ADS.
- They do not read or edit XAE project trees, Visual Studio documents, PLC
  project XML, source POUs, GVLs, DUTs, or engineering build output.
- If a user asks about files, project structure, POUs, tasks, I/O devices,
  boxes, terminals, or XAE tree items, switch to
  `twincat-xae-project-guidelines`.

## PLC Reads

- Prefer `plc_list_symbols` for discovery and exact casing.
- Prefer `plc_describe_symbol` before reading or writing structs, arrays, or
  unfamiliar symbols.
- Prefer `plc_read_many` when several values are needed together.
- Use configured PLC symbol groups only after `plc_list_groups` confirms the
  group name.
- If a read fails, treat it as symbol/configuration drift and rediscover the
  symbol path before retrying.

## NC Axes

- NC access is read-only.
- Use `nc_state` to verify NC ADS service state.
- Use `nc_list_axes` before reading an axis unless the exact configured axis name
  or ID is already known.
- Use `nc_read_axis_position` when position, velocity, state double word, or
  online-state values are enough.
- Use `nc_read_axis_status` when flags such as ready, referenced, in-position,
  or busy are enough.
- Use `nc_read_axis` as a best-effort aggregate. If optional status or error
  fields cannot be read, inspect `warnings` and still use available position and
  velocity values.
- Use `nc_read_error` for focused NC or axis error checks.

## IO Reads

- IO access is read-only.
- Use `io_list_groups` to inspect configured IO data points and group names.
- Use `io_read` for one configured data point and `io_read_many` or
  `io_read_group` for related values.
- Do not invent raw IO addresses. If a data point is missing, explain the
  required configuration entry.
- IO reads return decoded values plus raw hex; use raw hex when type decoding is
  suspicious or bit-level process data matters.

## Diagnostics

- Use `tc_state` for a compact runtime view across ADS services.
- Use `tc_event_list`, `tc_runtime_error_list`, and `tc_log_read` when the user
  names the exact diagnostic surface.
- Use `tc_diagnose_errors` for bounded error triage and `tc_diagnose_runtime` for
  runtime health. Keep limits and filters narrow.
- If a diagnostic source reports `available=false`, report that capability
  reason instead of treating it as a PLC or ADS failure.
- Do not use runtime diagnostics for XAE build output, Engineering error lists,
  or Visual Studio output windows.

## Writes

- Treat every write as safety-sensitive.
- Writes are blocked unless all gates pass:
  - config `readOnly` is `false`
  - runtime write mode is `enabled`
  - the exact symbol is present in `writeAllowlist`
- Use `plc_get_write_mode` and `plc_evaluate_write_access` to explain blocked
  writes.
- Do not enable write mode or write a value unless the user explicitly asks for
  that operational action and the target symbol is safe.
