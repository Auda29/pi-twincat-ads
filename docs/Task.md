# Task Breakdown für `pi-twincat-ads`

Diese Datei zerlegt den aktuellen Implementierungsplan in konkrete Umsetzungsschritte mit maximal zehn Tasks.

## Tasks

### 1. Projekt-Scaffold und Package-Basis aufsetzen

- TypeScript-Package-Struktur gemäß Plan anlegen: `src/index.ts`, `src/ads/`, `src/tools/`, `src/hooks/`, `skills/twincat-ads/`.
- `package.json`, TypeScript-Konfiguration und minimale Build-/Test-Skripte vorbereiten.
- Extension-Entry-Point so anlegen, dass spätere Tool- und Hook-Registrierung sauber anschließbar ist.

### 2. Konfigurationsmodell und Validierung implementieren

- Runtime-Config-Schema mit Zod anlegen.
- Pflicht- und Optionalfelder für Router-Modus und Direkt-Modus definieren.
- Defaults für `targetAdsPort`, `routerTcpPort` und `notificationCycleTimeMs` zentral setzen.
- Klare Validierungsfehler für ungültige AMS-/Router-Konfigurationen ausgeben.

### 3. ADS-Service mit Verbindungsmanagement bauen

- Zentralen ADS-Service auf Basis von `ads-client` implementieren.
- Connection-State (`disconnected`, `connecting`, `connected`, `degraded`) abbilden.
- Connect, Disconnect, Preflight-Checks und Reconnect-Grundlogik kapseln.
- Symbol-Upload und Basis-Metadaten-Laden an den Service hängen.

### 4. Symbol-, Typ- und Handle-Verwaltung ergänzen

- Symboltabelle für Discovery und Kontextbereitstellung laden und cachen.
- Handle-Cache für häufig genutzte Symbole und Writes einführen.
- Handle-Lebensdauer und Freigabe bei Reconnect bzw. Session-Ende sauber behandeln.
- Typ-Metadaten so aufbereiten, dass Reads, Writes und Symbol-Listen konsistent arbeiten.

### 5. Lese- und Status-Tools implementieren

- `plc_list_symbols(filter?)`, `plc_read(name)`, `plc_read_many(names[])` und `plc_state()` implementieren.
- `plc_read_many` intern als gebündelten Mehrfachzugriff auslegen.
- Einheitliche Rückgabeformate mit Name, Typ, Wert, Status und Zeitstempel definieren.
- Fehlerfälle für unbekannte Symbole und Verbindungsprobleme sauber abbilden.

### 6. Schreibpfad mit Sicherheitsregeln umsetzen

- `plc_write(name, value)` implementieren.
- `readOnly`-Schalter und `writeAllowlist` zentral durchsetzen.
- Schreibzugriffe mit klaren Ablehnungsgründen versehen.
- Schreibverhalten so kapseln, dass spätere Bestätigungslogik leicht anschließbar bleibt.

### 7. Watch- und Notification-System aufbauen

- `plc_watch(name)` mit ADS-Notifications implementieren.
- Default-Verhalten als `on change`, mit zyklischem Fallback über `notificationCycleTimeMs`.
- Notification-Registrierung, lokale Zuordnung und Deregistrierung sauber verwalten.
- Reconnect-Verhalten so bauen, dass aktive Watches automatisch neu registriert werden.

### 8. Hooks und Session-Lifecycle integrieren

- `session_start`, `before_agent_start`, `context`, `tool_call` und `session_end` implementieren.
- Session-Start mit Verbindungsaufbau und initialem Symbol-/Snapshot-Laden koppeln.
- Kontext-Hook auf kompakte Snapshot-Symbole begrenzen.
- Session-Ende für vollständiges Cleanup von Notifications, Handles und ADS-Verbindung nutzen.

### 9. Skill- und Entwicklerdokumentation erstellen

- `skills/twincat-ads/SKILL.md` mit Tool-Nutzung, Symbolpfaden und Write-Sicherheitsregeln anlegen.
- README um Installation, Konfiguration, ADS-Voraussetzungen und verfügbare Tools erweitern.
- Router-Modus und Direkt-Modus verständlich dokumentieren.

### 10. Tests und Smoke-Checks vervollständigen

- Unit- und Integrationstests für Config, ADS-Service, Tool-Verhalten und Hooks anlegen.
- Mock-basierten End-to-End-Test mit `ads-client` ergänzen.
- Reconnect-, Handle-Cache- und Notification-Recovery-Szenarien explizit testen.
- Manuellen Smoke-Test für TwinCAT-3-PLC auf Port `851` dokumentieren.
