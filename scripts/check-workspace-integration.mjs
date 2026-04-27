#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const workspacePackages = [
  "packages/core/package.json",
  "packages/pi/package.json",
  "packages/mcp/package.json",
];

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const packages = new Map();

for (const packagePath of workspacePackages) {
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  packages.set(manifest.name, {
    path: packagePath,
    manifest,
  });
}

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const workspaceName of ["twincat-mcp-core", "pi-twincat-ads"]) {
  const workspace = packages.get(workspaceName);
  expect(
    workspace?.manifest.version === rootPackage.version,
    `${workspaceName} must stay lockstepped with root version ${rootPackage.version}.`,
  );
}

for (const consumerName of ["pi-twincat-ads", "twincat-mcp"]) {
  const consumer = packages.get(consumerName);
  const core = packages.get("twincat-mcp-core");
  const dependencyVersion =
    consumer?.manifest.dependencies?.["twincat-mcp-core"];

  expect(
    dependencyVersion === core?.manifest.version,
    `${consumerName} must depend on twincat-mcp-core at version ${core?.manifest.version}.`,
  );
}

const mcpVersion = packages.get("twincat-mcp")?.manifest.version;
expect(
  mcpVersion === "0.1.0",
  "twincat-mcp remains at 0.1.0 for the first MCP server release.",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}
