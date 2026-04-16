import { readFile } from "node:fs/promises";
import process from "node:process";
import { createExtension } from "../dist/index.js";

async function main() {
  const [configPath, symbolName] = process.argv.slice(2);

  if (!configPath || !symbolName) {
    throw new Error(
      "Usage: node ./scripts/debug-symbol-lookup.mjs <configPath> <symbolName>",
    );
  }

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const extension = createExtension(config);
  const { adsService } = extension;

  try {
    await adsService.connect();

    const symbols = await adsService.client.getSymbols();
    const entries = Object.entries(symbols);
    const normalizedTarget = symbolName.trim().toLowerCase();

    const exactKey = entries.find(([name]) => name === symbolName);
    const normalizedKey = entries.find(
      ([name]) => name.trim().toLowerCase() === normalizedTarget,
    );
    const containsMatches = entries
      .filter(([name]) => name.toLowerCase().includes(normalizedTarget))
      .slice(0, 20)
      .map(([name, symbol]) => ({
        key: name,
        symbolName: symbol.name,
        type: symbol.type,
      }));

    console.log(
      JSON.stringify(
        {
          target: symbolName,
          exactKey: exactKey
            ? {
                key: exactKey[0],
                symbolName: exactKey[1].name,
                type: exactKey[1].type,
              }
            : null,
          normalizedKey: normalizedKey
            ? {
                key: normalizedKey[0],
                symbolName: normalizedKey[1].name,
                type: normalizedKey[1].type,
              }
            : null,
          containsMatches,
        },
        null,
        2,
      ),
    );
  } finally {
    await adsService.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
