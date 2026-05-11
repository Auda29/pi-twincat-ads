#!/usr/bin/env node

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedSkillName = "twincat-xae-project-guidelines";
const packageName = readPackageName();
const source = resolve(root, "packages", "skills", sharedSkillName);
const target = resolve(root, "packages", packageName, "skills", sharedSkillName);
const shouldClean = process.argv.includes("--clean");

function readPackageName() {
  const packageIndex = process.argv.indexOf("--package");
  const value = packageIndex === -1 ? undefined : process.argv[packageIndex + 1];

  if (value !== "pi" && value !== "mcp") {
    console.error("Usage: sync-package-skills.mjs --package <pi|mcp> [--clean]");
    process.exit(1);
  }

  return value;
}

await rm(target, { recursive: true, force: true });

if (shouldClean) {
  console.log(`Removed generated ${packageName} skill ${sharedSkillName}.`);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true, force: true });

console.log(`Synced ${sharedSkillName} into packages/${packageName}/skills.`);
