#!/usr/bin/env node

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BACKUP_NAME = ".package.json.workspace-backup";
const INTERNAL_DEPENDENCIES = ["twincat-ads-core"];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

async function prepare() {
  const manifestPath = join(process.cwd(), "package.json");
  const backupPath = join(process.cwd(), BACKUP_NAME);
  const manifest = await readJson(manifestPath);
  const rootManifest = await readJson(join(process.cwd(), "..", "..", "package.json"));
  const coreManifest = await readJson(
    join(process.cwd(), "..", "core", "package.json"),
  );
  let changed = false;

  await writeFile(backupPath, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const dependencyName of INTERNAL_DEPENDENCIES) {
    if (manifest.dependencies?.[dependencyName] === "workspace:*") {
      manifest.dependencies[dependencyName] =
        dependencyName === "twincat-ads-core"
          ? coreManifest.version
          : rootManifest.version;
      changed = true;
    }
  }

  if (changed) {
    await writeJson(manifestPath, manifest);
  }
}

async function restore() {
  const manifestPath = join(process.cwd(), "package.json");
  const backupPath = join(process.cwd(), BACKUP_NAME);

  try {
    const backup = await readFile(backupPath, "utf8");
    await writeFile(manifestPath, backup);
    await unlink(backupPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

const command = process.argv[2];

if (command === "prepare") {
  await prepare();
} else if (command === "restore") {
  await restore();
} else {
  console.error("Usage: pack-workspace-manifest.mjs prepare|restore");
  process.exitCode = 1;
}
