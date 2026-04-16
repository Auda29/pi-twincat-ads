import { readFile } from "node:fs/promises";
import process from "node:process";
import { createExtension } from "../dist/index.js";

async function main() {
  const [configPath, symbolName] = process.argv.slice(2);

  if (!configPath || !symbolName) {
    throw new Error(
      "Usage: node ./scripts/debug-read-many.mjs <configPath> <symbolName>",
    );
  }

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const extension = createExtension(config);

  try {
    await extension.adsService.connect();

    const single = await extension.adsService.readValue(symbolName);
    console.log("single", JSON.stringify(single, null, 2));

    const many = await extension.adsService.readMany([symbolName]);
    console.log("many", JSON.stringify(many, null, 2));
  } finally {
    await extension.adsService.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
