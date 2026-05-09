# PLC Object Model

Use this reference when editing PLC project files or explaining PLC objects in
TwinCAT XAE terms.

## Object Types

| XAE object | Meaning | Edit guidance |
| --- | --- | --- |
| Program | Runnable POU called by a PLC task | Preserve task bindings and call order. |
| Function Block | Instantiable POU with state | Preserve public interface, existing method/action layout, and instance usage. |
| Function | Stateless POU returning a value | Check call sites before changing inputs or return type. |
| Method | Child operation on a POU, FB, interface, or function | Keep it under the existing owner and match local naming/access patterns. |
| Action | Alternative implementation section below a POU or FB | Do not turn actions into methods unless requested. |
| Property | Getter/setter child below an object | Preserve getter/setter pairing and access modifiers. |
| GVL | Global Variable List | Treat public global names as project-wide API. |
| DUT | Data Unit Type: STRUCT, ENUM, UNION, alias, or related type | Check all usages before changing field order, enum values, or binary layout. |
| Interface | Contract implemented by FBs/classes | Changing method signatures can affect all implementers. |
| Library reference | External PLC library dependency | Preserve version pins unless the user requested dependency changes. |
| Task | Runtime scheduling entry or PLC call assignment | Avoid changing cycle, priority, and program call assignment unless requested. |

## Project File Consistency

- A new PLC object usually needs both a source XML file and a project reference
  from the `.plcproj`. Follow the existing project pattern for paths and include
  order.
- Some projects store methods, actions, or properties inside the owner POU file;
  others use child files or folders. Mirror the local layout.
- Keep declaration and implementation languages consistent with the surrounding
  object, such as ST, FBD, LD, SFC, or CFC markers.
- Preserve casing exactly. TwinCAT often accepts case-insensitive identifiers in
  code, but project files, paths, and allowlists may not.
- Avoid moving objects between folders unless the user asked for an XAE project
  tree move and the project references are updated consistently.

## Binary And Layout Risks

- Treat changes to DUT field order, enum values, array bounds, data types,
  packing pragmas, and retained/persistent variables as compatibility-sensitive.
- Treat public FB inputs, outputs, inouts, methods, and properties as APIs.
- Treat GVL variables used by HMI, NC, ADS clients, or recipes as integration
  points even if they look like ordinary global variables.

## User-Facing Language

Prefer:

- "I added method `Reset` under `FB_Axis`."
- "I updated the declaration of GVL `GVL_MachineState`."
- "I left the PLC task assignment unchanged."

Avoid leading with:

- "I edited the XML node."
- "I changed the file."
- "I modified line 42."

Technical references are useful after the XAE description, especially in code
review summaries.
