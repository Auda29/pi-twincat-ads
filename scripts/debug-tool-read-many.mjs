import { readFile } from "node:fs/promises";
import process from "node:process";
import { createExtension } from "../dist/index.js";

async function main() {
  const [configPath, symbolName] = process.argv.slice(2);

  if (!configPath || !symbolName) {
    throw new Error(
      "Usage: node ./scripts/debug-tool-read-many.mjs <configPath> <symbolName>",
    );
  }

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const extension = createExtension(config);
  const { tools, hooks } = await extension.register();

  const sessionStart = hooks.find((entry) => entry.name === "session_start");
  const sessionEnd = hooks.find((entry) => entry.name === "session_end");
  const plcReadMany = tools.find((entry) => entry.name === "plc_read_many");

  if (!sessionStart || !sessionEnd || !plcReadMany) {
    throw new Error("Required hooks/tools were not registered.");
  }

  try {
    console.log(await sessionStart.execute({}));
    console.log(await plcReadMany.execute({ names: [symbolName] }));
  } finally {
    console.log(await sessionEnd.execute({}));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
