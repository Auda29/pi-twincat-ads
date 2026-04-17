# Task Breakdown fuer `twincat-ads` Monorepo

Diese Datei zerlegt den naechsten Umbau von `pi-twincat-ads` in ein npm-workspaces-Monorepo mit `core`, `pi` und `mcp`.

## Tasks

### 1. Neues Monorepo-Skelett aufsetzen `[Open]`

- Neues Repo `twincat-ads` anlegen.
- npm-Workspaces konfigurieren.
- TypeScript Project References fuer Root und Unterpakete aufsetzen.
- Basisstruktur `packages/core`, `packages/pi`, `packages/mcp` anlegen.

### 2. `packages/pi` als lauffaehige Ausgangsbasis uebernehmen `[Open]`

- Den aktuellen Stand von `pi-twincat-ads` zunaechst nahezu 1:1 nach `packages/pi` uebernehmen.
- Build, Tests, Skill-Datei und Pi-Manifest dort wieder gruen bekommen.
- Sicherstellen, dass sich das Pi-Paket vor der Core-Extraktion weiterhin wie `pi-twincat-ads` verhaelt.

### 3. `twincat-ads-core` API und Paketgrenzen definieren `[Open]`

- Festlegen, welche Teile transportagnostisch in den Core gehoeren.
- Core-Exports definieren:
  - Config und Validierung
  - ADS-Service
  - Runtime-/Controller-Schicht
  - transportfreie Operationen wie `readSymbol`, `readMany`, `writeSymbol`, `watchSymbol`, `unwatchSymbol`, `listWatches`, `readState`, `setWriteMode`
- Pi- und MCP-spezifische Verantwortung explizit ausserhalb des Core halten.

### 4. Domänenlogik in `packages/core` extrahieren `[Open]`

- ADS-, Cache-, Watch-, Reconnect- und Write-Safety-Logik aus dem bisherigen Paket in `packages/core` verschieben.
- Das 3-Layer-Safety-Modell im Core verankern:
  - `readOnly`
  - Runtime-Write-Mode
  - `writeAllowlist`
- Sicherstellen, dass der Core keinerlei Pi-Hook-, Prompt- oder MCP-Protokolllogik enthaelt.

### 5. `packages/pi` auf den Core umstellen `[Open]`

- Pi-Adapter so umbauen, dass er nur noch den Core verwendet.
- Tool-Wrapper und Hook-Binding auf die Core-Operationen mappen.
- Kontext-Injection, `session_start`, `context`, `tool_call` und `session_shutdown` im Pi-Paket halten.
- Regressionen gegen den bisherigen `pi-twincat-ads`-Stand vermeiden.

### 6. `twincat-ads-mcp` als v0.1-Server aufbauen `[Open]`

- MCP-Paket mit `@modelcontextprotocol/sdk` als stdio-Server anlegen.
- Core-Operationen als MCP-Tools exponieren.
- Zod-/Core-Inputs sauber in JSON-Schema fuer MCP ueberfuehren.
- Watches in v0.1 zunaechst nur als Tools, noch nicht als Resources/Subscriptions modellieren.

### 7. Monorepo-Build, Tests und Paketintegration vervollstaendigen `[Open]`

- Root-Build ueber `tsc -b` fuer alle Pakete herstellen.
- Tests fuer Core, Pi und MCP sauber trennen.
- Sicherstellen, dass `packages/pi` und `packages/mcp` nur ueber `workspace:*` auf den Core zugreifen.
- Pack-/Publish-Checks fuer alle drei Pakete ergaenzen.

### 8. Versionierung und Release-Flows vorbereiten `[Open]`

- Zunaechst lockstepped Versionierung fuer alle drei Pakete einrichten.
- Release-Reihenfolge dokumentieren:
  - `twincat-ads-core`
  - `pi-twincat-ads@0.2.0`
  - `twincat-ads-mcp@0.1.0`
- Spaetere Umstellung auf Changesets nur vorbereiten, aber noch nicht erzwingen.

### 9. Dokumentation und Migration fertigziehen `[Open]`

- Root-README fuer das Monorepo schreiben.
- Paket-spezifische READMEs fuer `core`, `pi` und `mcp` anlegen.
- Migrationshinweise vom bisherigen `pi-twincat-ads`-Repo dokumentieren.
- Konfiguration, Safety-Modell und typische Deploy-/Testpfade fuer Pi und MCP beschreiben.
