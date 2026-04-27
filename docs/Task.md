# Task Breakdown fuer `twincat-mcp` Monorepo

Diese Datei zerlegt den naechsten Umbau von `pi-twincat-ads` in das offizielle `twincat-mcp` npm-workspaces-Monorepo mit `core`, `pi` und `mcp`.

## Tasks

## Phase 1: Monorepo, Core, Pi und MCP

### 1. Neues Monorepo-Skelett aufsetzen `[Done]`

- Neues Repo `twincat-mcp` anlegen.
- npm-Workspaces konfigurieren.
- TypeScript Project References fuer Root und Unterpakete aufsetzen.
- Basisstruktur `packages/core`, `packages/pi`, `packages/mcp` anlegen.

### 2. `packages/pi` als lauffaehige Ausgangsbasis uebernehmen `[Done]`

- Den aktuellen Stand von `pi-twincat-ads` zunaechst nahezu 1:1 nach `packages/pi` uebernehmen.
- Build, Tests, Skill-Datei und Pi-Manifest dort wieder gruen bekommen.
- Sicherstellen, dass sich das Pi-Paket vor der Core-Extraktion weiterhin wie `pi-twincat-ads` verhaelt.

### 3. `twincat-mcp-core` API und Paketgrenzen definieren `[Done]`

- Festlegen, welche Teile transportagnostisch in den Core gehoeren.
- Core-Exports definieren:
  - Config und Validierung
  - ADS-Service
  - Runtime-/Controller-Schicht
  - transportfreie Operationen wie `readSymbol`, `readMany`, `writeSymbol`, `watchSymbol`, `unwatchSymbol`, `listWatches`, `readState`, `setWriteMode`
- Pi- und MCP-spezifische Verantwortung explizit ausserhalb des Core halten.

### 4. Domänenlogik in `packages/core` extrahieren `[Done]`

- ADS-, Cache-, Watch-, Reconnect- und Write-Safety-Logik aus dem bisherigen Paket in `packages/core` verschieben.
- Das 3-Layer-Safety-Modell im Core verankern:
  - `readOnly`
  - Runtime-Write-Mode
  - `writeAllowlist`
- Sicherstellen, dass der Core keinerlei Pi-Hook-, Prompt- oder MCP-Protokolllogik enthaelt.

### 5. `packages/pi` auf den Core umstellen `[Done]`

- Pi-Adapter so umbauen, dass er nur noch den Core verwendet.
- Tool-Wrapper und Hook-Binding auf die Core-Operationen mappen.
- Kontext-Injection, `session_start`, `context`, `tool_call` und `session_shutdown` im Pi-Paket halten.
- Regressionen gegen den bisherigen `pi-twincat-ads`-Stand vermeiden.

### 6. `twincat-mcp` als v0.1-Server aufbauen `[Done]`

- MCP-Paket mit `@modelcontextprotocol/sdk` als stdio-Server anlegen.
- Core-Operationen als MCP-Tools exponieren.
- Zod-/Core-Inputs sauber in JSON-Schema fuer MCP ueberfuehren.
- Watches in v0.1 zunaechst nur als Tools, noch nicht als Resources/Subscriptions modellieren.

### 7. Monorepo-Build, Tests und Paketintegration vervollstaendigen `[Done]`

- Root-Build ueber `tsc -b` fuer alle Pakete herstellen.
- Tests fuer Core, Pi und MCP sauber trennen.
- Sicherstellen, dass `packages/pi` und `packages/mcp` nur ueber die versionierte Core-Paketdependency auf den Core zugreifen.
- Pack-/Publish-Checks fuer alle drei Pakete ergaenzen.

### 8. Versionierung und Release-Flows vorbereiten `[Done]`

- Zunaechst lockstepped Versionierung fuer alle drei Pakete einrichten.
- Release-Reihenfolge dokumentieren:
  - `twincat-mcp-core`
  - `pi-twincat-ads@next`
  - `twincat-mcp@0.1.0`
- Spaetere Umstellung auf Changesets nur vorbereiten, aber noch nicht erzwingen.

### 9. Dokumentation und Migration fertigziehen `[Done]`

- Root-README fuer das Monorepo schreiben.
- Paket-spezifische READMEs fuer `core`, `pi` und `mcp` anlegen.
- Migrationshinweise vom bisherigen `pi-twincat-ads`-Repo dokumentieren.
- Konfiguration, Safety-Modell und typische Deploy-/Testpfade fuer Pi und MCP beschreiben.

## Phase 2: PLC-, NC-, IO- und TwinCAT-Diagnose-Erweiterungen

### 10. Multi-Service-ADS-Basis fuer PLC, NC und IO vorbereiten `[Open]`

- Interne ADS-Service-Schicht so erweitern, dass mehrere TwinCAT-Services/Ports verwaltet werden koennen.
- Config-Modell um klar benannte Services erweitern, z. B. `plc`, `nc` und `io`.
- Default-Ports als Vorschlaege dokumentieren und immer konfigurierbar halten:
  - TC3 PLC Runtime 1: `851`
  - Weitere TC3 PLC Runtimes: `852+`
  - NC: `500`
  - IO: `300`
- Bestehende PLC-Tools kompatibel halten und intern auf die neue Service-Schicht migrieren.
- Gemeinsames Connection-, Reconnect-, Timeout- und State-Handling fuer alle Services wiederverwenden.

### 11. PLC-Tools um Symbolbeschreibung und Gruppen erweitern `[Open]`

- Bestehende `plc_*` Tools unveraendert weiterfuehren.
- `plc_describe_symbol` ergaenzen, um Typ, Groesse, Metadaten und Struct-/Array-Informationen zu einem Symbol zu liefern.
- Config-basierte PLC-Symbolgruppen einfuehren, z. B. `status`, `alarms`, `recipe` oder `diagnostics`.
- `plc_read_group` implementieren, um eine konfigurierte Symbolgruppe gezielt zu lesen.
- Tests fuer Symbolbeschreibung, unbekannte Symbole und Gruppen-Reads ergaenzen.

### 12. NC-Read-Only-Tools einfuehren `[Open]`

- NC-Zugriff zunaechst strikt read-only halten.
- Config fuer NC-Achsen definieren, z. B. Name, Achs-ID und optional Service-Port.
- `nc_state` implementieren, um ADS-/NC-Zustand zu pruefen.
- `nc_list_axes` implementieren, um konfigurierte oder erkannte Achsen anzuzeigen.
- `nc_read_axis` und `nc_read_axis_many` implementieren, um Achszustand, Position, Geschwindigkeit, Status und Fehler gezielt zu lesen.
- `nc_read_error` implementieren, um NC- oder Achsenfehler fokussiert auszulesen.

### 13. IO-Read-Only-Tools und IO-Gruppen einfuehren `[Open]`

- IO-Zugriff zunaechst strikt read-only halten.
- Config fuer einzelne IO-Datenpunkte definieren: Name, `indexGroup`, `indexOffset`, Typ und optional Beschreibung.
- Config-basierte IO-Gruppen einfuehren, z. B. `inputs`, `outputs`, `safety`, `valves` oder `sensors`.
- `io_read` und `io_read_many` fuer gezielte IO-Reads implementieren.
- `io_read_group` implementieren, um eine konfigurierte IO-Gruppe zu lesen.
- `io_list_groups` implementieren, um verfuegbare IO-Gruppen und Datenpunkte sichtbar zu machen.

### 14. TwinCAT-weite Diagnose-Tools fuer Fehler, Events und Output ergaenzen `[Open]`

- Backends fuer Runtime-Events, Engineering-Fehlerlisten und Output/Logs evaluieren, bevor die Tool-API festgezurrt wird.
- `tc_state` implementieren, um TwinCAT-/ADS-/PLC-/NC-Grundzustand kompakt zu pruefen.
- `tc_event_list` implementieren, um letzte TwinCAT/EventLogger-Meldungen zu lesen.
- `tc_error_list` implementieren, um Engineering-/Build-Fehlerlisten auszulesen, sofern eine Quelle konfiguriert ist.
- `tc_output_read` implementieren, um relevante Output-, Build- oder Logtexte gezielt zu lesen.
- Quellen fuer Error List und Output konfigurierbar halten, weil Runtime-Diagnose und Engineering-Ausgabe technisch unterschiedliche Backends haben werden oder koennen.
- Filter wie `limit`, `since`, `severity` und Textsuche vorsehen, damit die Tools keine grossen unkontrollierten Dumps erzeugen.

### 15. Kleine Kombi-Diagnose-Commands bewusst begrenzen `[Open]`

- Kein globales "alles auslesen"-Tool einfuehren.
- `tc_diagnose_errors` als kleine Kombination aus Fehlerliste, Output und letzten Events implementieren.
- `tc_diagnose_runtime` als kleine Kombination aus TC-State, PLC-State, NC-State und aktiven Fehlern implementieren.
- Beide Diagnose-Commands mit Limits, Filtern und klarer Ausgabe strukturieren.
- Dokumentieren, wann einzelne Commands bevorzugt werden und wann die Kombi-Commands sinnvoll sind.
