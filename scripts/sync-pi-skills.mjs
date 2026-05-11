#!/usr/bin/env node

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharedSkillName = "twincat-xae-project-guidelines";
const source = resolve(root, "packages", "skills", sharedSkillName);
const target = resolve(root, "packages", "pi", "skills", sharedSkillName);
const shouldClean = process.argv.includes("--clean");

await rm(target, { recursive: true, force: true });

if (shouldClean) {
  console.log(`Removed generated Pi skill ${sharedSkillName}.`);
  process.exit(0);
}

await mkdir(dirname(target), { recursive: true });
await cp(source, target, {
  recursive: true,
  force: true,
  filter: (path) => !path.includes(`${sharedSkillName}\\node_modules`),
});

console.log(`Synced ${sharedSkillName} into packages/pi/skills.`);
