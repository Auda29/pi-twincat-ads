pi-twincat-ads — Kurzfassung

Zweck: Pi-Agent bekommt Lese-/Schreibzugriff auf TwinCAT-Runtime-Werte via ADS.

Stack:



TypeScript-Package, installierbar via pi install

ads-client (Jussi Isotalo) als ADS-Lib — pure JS, keine native Dep

Pi Extension-API für Tool-Registration und Hooks



Tools:



plc\_list\_symbols(filter?) — Symbole mit Typ/Scope/Kommentar

plc\_read(name) / plc\_read\_many(names\[]) — Einzel- und Sum-Read

plc\_write(name, value) — hinter Allowlist-Gate

plc\_watch(name) — Notification-Subscription

plc\_state() — Run/Config/Stop + RTime-Info

plc\_log(since?) — ADS-Log / TcEventLogger



Pi-Hooks nutzen:



session\_start → ADS-Connection auf, Symbol-Upload cachen

before\_agent\_start → Symboltabelle/Achsen-Übersicht initial mitgeben

context → optional kompakten Live-Snapshot (State, Fehler, aktive NCI-Kanäle) pro Turn injizieren

tool\_call → Write-Allowlist enforcen, Confirmations

session\_end → Handles freigeben, disconnect



Config:



AMS NetID + Port (default 851)

Read-only / Write-allowlist

Snapshot-Variablen für den context hook

Notification-Cycle-Time



Skill-Layer:



SKILL.md nach Agent-Skills-Standard — wann welches Tool, wie Symbolpfade aussehen, dass Writes Bestätigung brauchen



Interne Basics:



Symbol-Handle-Cache (nicht bei jedem Read neu auflösen)

Typ-Decoder aus TMC-Upload (macht ads-client größtenteils selbst)

Reconnect-Logik

Zod/TypeBox-Schemas für Tool-Params



Repo-Struktur:

src/index.ts            # Extension entry

src/ads/                # Client-Wrapper, Connection-Mgmt

src/tools/              # ein File pro Tool

src/hooks/              # context-Injection, tool\_call-Gate

skills/twincat-ads/     # SKILL.md

package.json            # keyword "pi-package"

