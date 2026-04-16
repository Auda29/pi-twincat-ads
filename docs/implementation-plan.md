# Implementierungsplan für `pi-twincat-ads`

Diese Datei enthält den aktuellen Umsetzungsplan für `pi-twincat-ads`.

## Summary

Ziel ist ein erstes nutzbares Pi-Extension-Package in TypeScript, das TwinCAT-Variablen über ADS lesbar macht, kontrollierte Schreibzugriffe erlaubt und dem Agenten zur Laufzeit nützlichen PLC-Kontext liefert. Die erste Version sollte klar auf Stabilität und sichere Bedienung optimiert sein: robuste Verbindungsverwaltung, saubere Tool-Schemas, konservative Write-Gates und ein kleines, gut testbares Hook-Set.

## Key Changes

### Paket-Grundgerüst und Laufzeitkern

- TypeScript-Package mit `pi install`-fähigem Entry Point aufbauen und die Basisstruktur aus `brainstorm.md` übernehmen: `src/index.ts`, `src/ads/`, `src/tools/`, `src/hooks/`, `skills/twincat-ads/`.
- Einen zentralen ADS-Service einführen, der Connection-Aufbau, Reconnect, Disconnect, Symbol-Upload und Handle-Caching kapselt.
- Symbol- und Handle-Caches getrennt halten: Symboltabelle für Discovery/Context, Handles für häufige Reads/Writes.
- Konfiguration beim Start validieren und intern als normierte Runtime-Config bereitstellen.

### Öffentliche Tools und Interfaces

- Folgende Tools als öffentliche Surface der Extension bereitstellen:
  - `plc_list_symbols(filter?)`
  - `plc_read(name)`
  - `plc_read_many(names[])`
  - `plc_write(name, value)`
  - `plc_watch(name)`
  - `plc_state()`
  - `plc_log(since?)`
- Alle Tool-Parameter und Rückgaben mit Zod oder TypeBox eindeutig schema-basiert beschreiben; bevorzugt Zod, weil es für Tool-Validierung und klare Fehlermeldungen am direktesten ist.
- Rückgaben konsistent halten:
  - Reads liefern immer Symbolname, gelesenen Wert, Typ und Zeitstempel.
  - `plc_list_symbols` liefert mindestens Name, Typ, Scope und Kommentar.
  - `plc_write` liefert alten Wert optional nur dann, wenn er ohne Zusatzkosten verfügbar ist; Pflicht ist Schreibstatus plus Zielsymbol und neuer Wert.
  - `plc_watch` liefert ein Subscription-Ergebnis mit Handle/Status; kein dauerhaft streamendes Interface in v1 planen, sondern eine klar definierte Notification-Registrierung.
  - `plc_state` liefert ADS/TwinCAT-State plus verfügbare Runtime-Infos.
  - `plc_log` bleibt in v1 optional-fallbackfähig: wenn TcEventLogger nicht verlässlich verfügbar ist, soll das Tool eine klare “nicht unterstützt/noch nicht konfiguriert”-Antwort geben statt halbgare Daten.
- Öffentliche Config-Schnittstelle festlegen:
  - `amsNetId: string`
  - `adsPort?: number` mit Default `851`
  - `readOnly?: boolean`
  - `writeAllowlist?: string[]`
  - `contextSnapshotSymbols?: string[]`
  - `notificationCycleTimeMs?: number`

### Hooks und Sicherheitsmodell

- `session_start`: ADS verbinden, Symboltabelle laden, Basiscaches vorbereiten.
- `before_agent_start`: kompakten Startkontext erzeugen, z. B. PLC-State und relevante Snapshot-Symbole.
- `context`: optionalen kompakten Live-Snapshot injizieren; nur konfigurierte Snapshot-Symbole, damit der Prompt klein bleibt.
- `tool_call`: alle Writes zentral prüfen.
  - Wenn `readOnly=true`, jeden Write blockieren.
  - Wenn `writeAllowlist` gesetzt ist, nur exakte oder bewusst definierte Pattern-Matches erlauben; Default ist exakter Match, um Fehlfreigaben zu vermeiden.
  - Schreibende Tool-Calls markieren, damit Bestätigungslogik sauber anschließbar bleibt.
- `session_end`: Notifications deregistrieren, Handles freigeben, ADS sauber trennen.

### Skill- und Bedienebene

- `skills/twincat-ads/SKILL.md` als Nutzungsleitfaden anlegen.
- Skill dokumentiert:
  - wann welches Tool zu verwenden ist
  - wie TwinCAT-Symbolpfade typischerweise aussehen
  - dass Writes potenziell Anlagenzustand ändern und nur mit Freigabe erfolgen sollen
  - dass zuerst Read/State geprüft werden soll, bevor geschrieben wird
- README nach Scaffold-Stand erweitern: Installation, Konfiguration, verfügbare Tools, Sicherheitsmodell, grober Entwicklungsworkflow.

## Test Plan

- Konfigurationsvalidierung:
  - gültige Minimal-Config
  - ungültige `amsNetId`
  - `readOnly` plus `writeAllowlist`
  - Defaults für Port und Notification-Zyklus
- ADS-Service:
  - erfolgreicher Connect/Disconnect
  - Reconnect nach Verbindungsabbruch
  - Symbol-Cache wird einmal geladen und wiederverwendet
  - Handle-Cache invalidiert sich sauber bei Reconnect
- Tool-Verhalten:
  - `plc_read` für gültiges und ungültiges Symbol
  - `plc_read_many` mit gemischten Treffern
  - `plc_list_symbols` mit und ohne Filter
  - `plc_write` erlaubt, blockiert durch `readOnly`, blockiert durch fehlende Allowlist
  - `plc_state` bei verbundener und nicht verbundener Runtime
  - `plc_watch` registriert und räumt Subscription wieder auf
  - `plc_log` liefert klare Fallback-Antwort, wenn kein Logger angebunden ist
- Hook-Verhalten:
  - `session_start` baut Verbindung auf
  - `before_agent_start` erzeugt kompakten Initialkontext
  - `context` respektiert Snapshot-Konfiguration
  - `session_end` räumt Ressourcen vollständig auf
- Integration:
  - End-to-End-Test mit gemocktem `ads-client`
  - optional manueller Smoke-Test gegen TwinCAT auf Port `851`

## Assumptions

- Das Repo ist noch in der Design-/Scaffold-Phase; der Plan zielt daher auf eine erste implementierbare v1-Struktur, nicht auf Refactoring bestehender Produktionslogik.
- `ads-client` übernimmt den Großteil der TwinCAT-Typdekodierung; wir bauen darum keinen eigenen Low-Level-Decoder für v1.
- `plc_log` ist funktional nachrangig und darf in v1 mit klarer Einschränkung ausgeliefert werden, falls die ADS-/TcEventLogger-Anbindung aufwendiger ist als die Kern-Tools.
- Die sichere Default-Politik ist: lesen erlaubt, schreiben nur mit expliziter Freigabe über `writeAllowlist`, und `readOnly` hat immer Vorrang.
- Für v1 werden Symbolfreigaben standardmäßig als exakte Symbolnamen behandelt; Wildcards oder Präfixregeln werden nur aufgenommen, wenn sie später bewusst spezifiziert werden.
