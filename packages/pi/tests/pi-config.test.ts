import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PLC_CONFIG_FILENAME,
  persistTargetConfigUpdate,
  resolvePiConfig,
} from "../src/pi-config.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-twincat-ads-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (tempDir) => {
      await rm(tempDir, { recursive: true, force: true });
    }),
  );
});

describe("pi config", () => {
  it("creates a default plc.config.json automatically", async () => {
    const cwd = await createTempDir();

    const resolved = await resolvePiConfig({ cwd });

    expect(resolved.createdDefaultConfig).toBe(true);
    expect(resolved.configPath).toBe(
      path.join(cwd, DEFAULT_PLC_CONFIG_FILENAME),
    );
    expect(resolved.config.targetAmsNetId).toBe("127.0.0.1.1.1");
    expect(resolved.config.targetAdsPort).toBe(851);

    const writtenFile = JSON.parse(
      await readFile(resolved.configPath!, "utf8"),
    ) as { targetAmsNetId: string; targetAdsPort: number };

    expect(writtenFile.targetAmsNetId).toBe("localhost");
    expect(writtenFile.targetAdsPort).toBe(851);
  });

  it("updates the persisted PLC target config", async () => {
    const cwd = await createTempDir();
    const resolved = await resolvePiConfig({ cwd });

    const updated = await persistTargetConfigUpdate({
      configPath: resolved.configPath!,
      targetAmsNetId: "192.168.10.20.1.1",
    });

    expect(updated.targetAmsNetId).toBe("192.168.10.20.1.1");
    expect(updated.targetAdsPort).toBe(851);

    const writtenFile = JSON.parse(
      await readFile(resolved.configPath!, "utf8"),
    ) as { targetAmsNetId: string };

    expect(writtenFile.targetAmsNetId).toBe("192.168.10.20.1.1");
  });

  it("updates both top-level and service PLC ports", async () => {
    const cwd = await createTempDir();
    const resolved = await resolvePiConfig({ cwd });

    const updated = await persistTargetConfigUpdate({
      configPath: resolved.configPath!,
      targetAmsNetId: "192.168.10.20.1.1",
      targetAdsPort: 852,
    });

    expect(updated.targetAdsPort).toBe(852);
    expect(updated.services.plc.targetAdsPort).toBe(852);

    const writtenFile = JSON.parse(
      await readFile(resolved.configPath!, "utf8"),
    ) as {
      targetAdsPort: number;
      services: { plc: { targetAdsPort: number } };
    };

    expect(writtenFile.targetAdsPort).toBe(852);
    expect(writtenFile.services.plc.targetAdsPort).toBe(852);
  });
});
