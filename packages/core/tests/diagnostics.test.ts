import { describe, expect, it } from "vitest";

import { RuntimeDiagnostics } from "../src/diagnostics.js";

describe("RuntimeDiagnostics", () => {
  it("reports default Windows event sources as unavailable off Windows", async () => {
    const diagnostics = new RuntimeDiagnostics(
      {
        maxEvents: 50,
        maxLogBytes: 65_536,
        eventSources: [
          {
            id: "events",
            kind: "windowsEventLog",
            logName: "Application",
            providerNames: ["TwinCAT"],
            commandTimeoutMs: 1000,
          },
        ],
        logSources: [],
      },
      { platform: "linux" },
    );

    const result = await diagnostics.listEvents();

    expect(result.available).toBe(false);
    expect(result.capability.reason).toContain("only available on Windows");
  });

  it("normalizes Windows Event Log rows from PowerShell", async () => {
    const commands: Array<{ command: string; args: readonly string[] }> = [];
    const diagnostics = new RuntimeDiagnostics(
      {
        maxEvents: 10,
        maxLogBytes: 65_536,
        eventSources: [
          {
            id: "events",
            kind: "windowsEventLog",
            logName: "Application",
            providerNames: ["TwinCAT"],
            commandTimeoutMs: 1000,
          },
        ],
        logSources: [
          {
            id: "logs",
            kind: "windowsEventLog",
            logName: "Application",
            providerNames: ["TwinCAT"],
            commandTimeoutMs: 1000,
          },
        ],
      },
      {
        platform: "win32",
        commandRunner: {
          async run(command, args) {
            commands.push({ command, args });
            return {
              stdout: JSON.stringify([
                {
                  timestamp: "2026-05-05T18:00:00.0000000Z",
                  source: "TcSysSrv",
                  provider: "TcSysSrv",
                  logName: "Application",
                  id: 1001,
                  level: 2,
                  levelDisplayName: "Error",
                  message: "Runtime error",
                  machineName: "IPC",
                  recordId: 42,
                },
              ]),
              stderr: "",
              exitCode: 0,
            };
          },
        },
      },
    );

    const events = await diagnostics.listEvents({
      limit: 5,
      severity: "error",
      contains: "Runtime",
    });
    const log = await diagnostics.readLog({ source: "logs", tailLines: 1 });

    expect(commands[0]?.command).toBe("pwsh.exe");
    expect(events.available).toBe(true);
    expect(events.events[0]).toMatchObject({
      source: "TcSysSrv",
      severity: "error",
      id: 1001,
      message: "Runtime error",
    });
    expect(log.text).toContain("[error] TcSysSrv 1001: Runtime error");
  });

  it("treats empty Windows Event Log matches as an available empty result", async () => {
    const diagnostics = new RuntimeDiagnostics(
      {
        maxEvents: 10,
        maxLogBytes: 65_536,
        eventSources: [
          {
            id: "events",
            kind: "windowsEventLog",
            logName: "Application",
            providerNames: ["TwinCAT"],
            commandTimeoutMs: 1000,
          },
        ],
        logSources: [],
      },
      {
        platform: "win32",
        commandRunner: {
          async run() {
            return {
              stdout: "[]",
              stderr: "",
              exitCode: 0,
            };
          },
        },
      },
    );

    const result = await diagnostics.listEvents({
      since: "2099-01-01T00:00:00.000Z",
    });

    expect(result.available).toBe(true);
    expect(result.count).toBe(0);
    expect(result.events).toEqual([]);
  });

  it("maps severity unknown to an explicit Windows Event Log level filter", async () => {
    let payload: { levels?: number[] } | undefined;
    const diagnostics = new RuntimeDiagnostics(
      {
        maxEvents: 10,
        maxLogBytes: 65_536,
        eventSources: [
          {
            id: "events",
            kind: "windowsEventLog",
            logName: "Application",
            providerNames: ["TwinCAT"],
            commandTimeoutMs: 1000,
          },
        ],
        logSources: [],
      },
      {
        platform: "win32",
        commandRunner: {
          async run(_command, args) {
            payload = JSON.parse(String(args[args.length - 1])) as {
              levels?: number[];
            };
            return {
              stdout: JSON.stringify([
                {
                  timestamp: "2026-05-05T18:00:00.0000000Z",
                  source: "TcSysSrv",
                  provider: "TcSysSrv",
                  logName: "Application",
                  id: 1002,
                  level: 0,
                  levelDisplayName: "LogAlways",
                  message: "Runtime entry without standard level",
                  machineName: "IPC",
                  recordId: 43,
                },
              ]),
              stderr: "",
              exitCode: 0,
            };
          },
        },
      },
    );

    const result = await diagnostics.listEvents({ severity: "unknown" });

    expect(payload?.levels).toEqual([0]);
    expect(result.events[0]?.severity).toBe("unknown");
  });
});
