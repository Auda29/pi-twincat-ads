# XAE File To UI Map

Use this reference to translate between repository artifacts, XML, and the
TwinCAT XAE project tree. Names and exact XML shapes vary by TwinCAT version and
project style, so prefer nearby examples from the same project over generic
templates.

## Mapping Table

| Artifact or clue | XAE project-tree concept | User-facing wording |
| --- | --- | --- |
| `.sln` | Visual Studio solution containing TwinCAT projects | "solution" |
| `.tsproj` | TwinCAT XAE/System Manager project | "TwinCAT project" or "System Manager project" |
| `.plcproj` | PLC project under the PLC node | "PLC project" |
| `.TcPOU` or XML with a `POU` element | POU: Program, Function Block, or Function | "program", "FB", "function", or "POU" |
| XML method child or method file under a POU folder | Method below a POU, FB, interface, or function | "method on `FB_Name`" |
| XML action child or action file under a POU folder | Action below a POU or FB | "action on `POU_Name`" |
| XML property getter/setter child | Property below a POU, FB, or interface | "property on `FB_Name`" |
| `.TcGVL` or XML with a `GVL` element | Global Variable List | "GVL" |
| `.TcDUT` or XML with a `DUT` element | Data Unit Type such as STRUCT, ENUM, UNION, alias | "DUT" |
| `.TcIO` or interface-like PLC XML | Interface | "interface" |
| PLC task binding in `.plcproj` or task XML | PLC task assignment or call tree | "task" or "PLC task" |
| System Manager task node | Real-time task under SYSTEM | "real-time task" |
| TreeItem path string | Automation Interface path to a project-tree node | "XAE tree path" |
| I/O device XML/tree node | EtherCAT or fieldbus master/device | "I/O Device" |
| I/O box XML/tree node | EtherCAT slave or fieldbus box below a device | "Box" |
| Terminal XML/tree node | Beckhoff terminal or module below a box | "Terminal" or "Klemme" if the user uses German XAE terms |

## Translation Rules

- Translate from path to XAE term before explaining the change. For example,
  say "I changed the implementation of `FB_Valve.Open`" before citing
  `POUs/FB_Valve.TcPOU`.
- Treat XML line numbers as implementation detail. Include them only when useful
  for review, diagnostics, or a patch reference.
- If a file maps to more than one XAE node, name the owning node and the child
  node. For example, "`FB_Axis` method `Reset`" is clearer than "method XML".
- Distinguish System Manager tasks from PLC task assignments. Both may appear as
  "Task" in conversation, but they live in different parts of the XAE tree.
- Preserve exact TreeItem path strings unless the task is explicitly to rename,
  move, or recreate that XAE node.

## Identity Fields To Treat Carefully

- GUIDs, object IDs, class IDs, instance IDs, and TcSm item IDs.
- TreeItem paths and path segments used by Automation Interface tooling.
- Device, box, and terminal addresses, revision identifiers, and linked process
  image mappings.
- PLC object names, namespaces, include paths, and compile order entries.
- Task names, cycle times, priorities, core bindings, and PLC call assignments.
