---
name: twincat-xae-project-guidelines
description: >-
  Agent-neutral guidelines for editing and reviewing TwinCAT 3 XAE/Visual Studio
  project files, PLC project XML, .tsproj/.plcproj artifacts, POUs, GVLs, DUTs,
  tasks, I/O tree items, devices, boxes, and terminals. Use when an agent works on
  TwinCAT XAE project structure, maps files/XML/paths to the XAE project tree,
  or communicates project-file changes in XAE terms while avoiding unsafe online
  actions.
---

# TwinCAT XAE Project Guidelines

Use this skill for TwinCAT 3 XAE project-file work: offline edits, reviews,
project-tree reasoning, and user-facing explanations. Do not use it as runtime
ADS guidance; if runtime values or diagnostics are needed, use a TwinCAT ADS
skill or tool separately.

## Workflow

1. Identify the XAE surface behind each artifact before editing. Load
   [xae-file-to-ui-map.md](references/xae-file-to-ui-map.md) when translating
   files, XML, or paths into XAE project-tree terms.
2. Classify PLC objects before changing them. Load
   [plc-object-model.md](references/plc-object-model.md) when POUs, programs,
   FBs, functions, methods, actions, properties, GVLs, DUTs, interfaces,
   libraries, or tasks are involved.
3. Preserve TwinCAT identity and ordering. Do not change GUIDs, IDs, object
   names, TreeItem paths, task bindings, device identities, or project include
   order unless the user explicitly asked for that specific change.
4. Copy nearby project patterns instead of inventing structure. Match existing
   file locations, XML shape, casing, language markers, namespace style,
   comments, and declaration/implementation split.
5. Avoid generated or target-derived artifacts. Keep edits in source project
   files and keep XML well formed; do not mass-format TwinCAT XML unless the
   repository already does that.
6. Enforce the online safety boundary. Load
   [project-safety-rules.md](references/project-safety-rules.md) before any
   action that could affect a live target, runtime state, safety configuration,
   debugging session, or deployed configuration.
7. Explain results in XAE/user terms first. Mention file paths, XML elements,
   or line numbers only as technical references after saying which POU, FB,
   method, GVL, DUT, task, I/O device, box, or terminal changed.

## References

- [xae-file-to-ui-map.md](references/xae-file-to-ui-map.md): Load when mapping
  project files, XML nodes, TreeItem paths, or folder paths to XAE UI concepts.
- [plc-object-model.md](references/plc-object-model.md): Load when creating,
  moving, or reviewing PLC objects and compile/project references.
- [project-safety-rules.md](references/project-safety-rules.md): Load before
  build/online/debug/deploy/safety-adjacent work or when user intent is unclear.
- [common-twincat-workflows.md](references/common-twincat-workflows.md): Load
  for common offline edits such as finding objects, editing a POU, adding PLC
  objects, or reviewing I/O tree changes.

## Core Rules

- Treat the XAE project tree and the XML/file graph as two views of the same
  project. Keep them consistent.
- Prefer the smallest edit that matches the existing project style.
- Verify XML syntax after edits when a parser or project build is available.
- Never silently convert TwinCAT concepts into generic code terms in user
  communication. Say "FB method", "GVL", "DUT", "Task", "I/O Device", "Box",
  or "Terminal" when those are the user's XAE objects.
