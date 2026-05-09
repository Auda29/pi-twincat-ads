# Common TwinCAT Workflows

Use these workflows for offline XAE project work. Keep each step scoped to the
workspace unless the user explicitly asks for an online XAE action.

## Find An Object From User Language

1. Extract the strongest XAE terms from the request: FB, POU, method, GVL, DUT,
   task, I/O device, box, terminal, or Klemme.
2. Search by exact object name first, then by distinctive variable or method
   names.
3. Inspect the owning project file before editing, especially `.plcproj` and the
   owner POU file.
4. Translate the result back to XAE terms before acting.

## Edit A POU, FB, Method, Or Action

1. Read the owner POU and nearby similar objects.
2. Preserve declaration/implementation language and XML shape.
3. Change the smallest relevant declaration or implementation section.
4. Do not reorder unrelated methods, actions, properties, variables, or XML
   nodes.
5. Validate XML well-formedness when possible.
6. Summarize the changed XAE object and include file paths only as references.

## Add A PLC Object

1. Find an existing object of the same type in the same PLC project.
2. Copy the local file naming, folder placement, XML structure, project include
   entry style, and compile order pattern.
3. Create only the required source file and project reference.
4. Do not invent GUID or ID formats if the project has a generated pattern that
   should come from XAE. Prefer asking for confirmation or documenting the
   limitation.
5. Check for task assignment only if adding a runnable program. Do not assign it
   to a task unless requested.

## Review Or Adjust I/O Tree Files

1. Treat I/O tree edits as higher risk than ordinary PLC code edits.
2. Identify the XAE node type: I/O Device, Box, Terminal, channel, mapping, or
   process image link.
3. Preserve addresses, revisions, IDs, and mapping references unless the user
   requested the exact change.
4. Avoid scans or online hardware discovery unless explicitly requested.
5. Explain changes in I/O tree terms, not as generic XML edits.

## Validation Checklist

- XML is well formed for edited project files.
- The `.plcproj` references every new PLC source file and no removed file remains
  referenced.
- Names, casing, folder paths, and include order match nearby objects.
- No generated, build-output, or target-derived artifacts were edited.
- No online action was performed unless explicitly requested.
- Final explanation names XAE objects first and file/XML references second.
