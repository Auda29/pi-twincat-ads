import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { createExtension } from "../dist/index.js";

function parseArgs(argv) {
  const args = {
    configPath: process.env.PI_TWINCAT_ADS_CONFIG ?? null,
    symbol: process.env.PI_TWINCAT_ADS_SYMBOL ?? null,
    watchSymbol: process.env.PI_TWINCAT_ADS_WATCH_SYMBOL ?? null,
    writeSymbol: process.env.PI_TWINCAT_ADS_WRITE_SYMBOL ?? null,
    writeValue: process.env.PI_TWINCAT_ADS_WRITE_VALUE ?? null,
    enableWrite: process.env.PI_TWINCAT_ADS_ENABLE_WRITE === "1",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = argv[index + 1];

    switch (argument) {
      case "--config":
        args.configPath = nextValue ?? null;
        index += 1;
        break;
      case "--symbol":
        args.symbol = nextValue ?? null;
        index += 1;
        break;
      case "--watch-symbol":
        args.watchSymbol = nextValue ?? null;
        index += 1;
        break;
      case "--write-symbol":
        args.writeSymbol = nextValue ?? null;
        index += 1;
        break;
      case "--write-value":
        args.writeValue = nextValue ?? null;
        index += 1;
        break;
      case "--enable-write":
        args.enableWrite = true;
        break;
      default:
        break;
    }
  }

  return args;
}

function parseJsonValue(rawValue) {
  if (rawValue == null) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

async function loadConfig(configPath) {
  if (!configPath) {
    throw new Error(
      "Missing config path. Use --config <path> or set PI_TWINCAT_ADS_CONFIG.",
    );
  }

  const callerCwd = process.env.INIT_CWD ?? process.cwd();
  const resolvedConfigPath = isAbsolute(configPath)
    ? configPath
    : resolve(callerCwd, configPath);
  const rawConfig = await readFile(resolvedConfigPath, "utf8");
  return JSON.parse(rawConfig);
}

function logStep(title, payload) {
  console.log(`\n### ${title}`);
  console.log(JSON.stringify(payload, null, 2));
}

function requireTool(tools, name) {
  const tool = tools.find((entry) => entry.name === name);

  if (!tool) {
    throw new Error(`Required tool '${name}' was not registered.`);
  }

  return tool;
}

function requireHook(hooks, name) {
  const hook = hooks.find((entry) => entry.name === name);

  if (!hook) {
    throw new Error(`Required hook '${name}' was not registered.`);
  }

  return hook;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig(args.configPath);
  const extension = createExtension(config);
  const registration = await extension.register();

  const sessionStart = requireHook(registration.hooks, "session_start");
  const beforeAgentStart = requireHook(registration.hooks, "before_agent_start");
  const contextHook = requireHook(registration.hooks, "context");
  const sessionEnd = requireHook(registration.hooks, "session_end");

  const plcState = requireTool(registration.tools, "plc_state");
  const plcListSymbols = requireTool(registration.tools, "plc_list_symbols");
  const plcRead = requireTool(registration.tools, "plc_read");
  const plcReadMany = requireTool(registration.tools, "plc_read_many");
  const plcWatch = requireTool(registration.tools, "plc_watch");
  const plcListWatches = requireTool(registration.tools, "plc_list_watches");
  const plcUnwatch = requireTool(registration.tools, "plc_unwatch");
  const plcSetWriteMode = requireTool(registration.tools, "plc_set_write_mode");
  const plcWrite = requireTool(registration.tools, "plc_write");

  const sampleSymbol = args.symbol ?? args.watchSymbol ?? args.writeSymbol;
  const watchSymbol = args.watchSymbol ?? sampleSymbol;

  try {
    logStep("session_start", await sessionStart.execute({}));
    logStep("before_agent_start", await beforeAgentStart.execute({}));
    logStep("context", await contextHook.execute({}));
    logStep("plc_state", await plcState.execute({}));
    logStep(
      "plc_list_symbols",
      await plcListSymbols.execute({
        filter: sampleSymbol ? sampleSymbol.split(".")[0] : undefined,
      }),
    );

    if (sampleSymbol) {
      logStep("plc_read", await plcRead.execute({ name: sampleSymbol }));
      logStep(
        "plc_read_many",
        await plcReadMany.execute({ names: [sampleSymbol] }),
      );
    } else {
      console.log(
        "\n### plc_read / plc_read_many skipped\nNo sample symbol provided.",
      );
    }

    if (watchSymbol) {
      logStep(
        "plc_watch",
        await plcWatch.execute({
          name: watchSymbol,
        }),
      );
      logStep("plc_list_watches", await plcListWatches.execute({}));
      logStep("plc_unwatch", await plcUnwatch.execute({ name: watchSymbol }));
    } else {
      console.log("\n### plc_watch skipped\nNo watch symbol provided.");
    }

    if (args.enableWrite && args.writeSymbol && args.writeValue != null) {
      logStep(
        "plc_set_write_mode",
        await plcSetWriteMode.execute({ mode: "enabled" }),
      );
      logStep(
        "plc_write",
        await plcWrite.execute({
          name: args.writeSymbol,
          value: parseJsonValue(args.writeValue),
        }),
      );
      logStep("plc_set_write_mode(reset)", await plcSetWriteMode.execute({
        mode: "read-only",
      }));
    } else {
      console.log(
        "\n### plc_write skipped\nWrite test disabled. Use --enable-write with --write-symbol and --write-value only for safe symbols.",
      );
    }
  } finally {
    logStep("session_end", await sessionEnd.execute({}));
  }
}

main().catch((error) => {
  console.error("\nLocal dev smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
