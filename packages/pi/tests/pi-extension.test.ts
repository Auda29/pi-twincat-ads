import { describe, expect, it, vi } from "vitest";

import piTwinCatAdsExtension from "../src/pi-extension.js";

describe("Pi host extension", () => {
  it("registers NC and IO tools with the actual Pi host adapter", () => {
    const registeredTools: Array<{ name: string }> = [];
    const pi = {
      registerFlag: vi.fn(),
      getFlag: vi.fn(() => undefined),
      registerTool: vi.fn((tool: { name: string }) => {
        registeredTools.push(tool);
      }),
      on: vi.fn(),
    };

    piTwinCatAdsExtension(pi as never);

    expect(registeredTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "nc_state",
        "nc_list_axes",
        "nc_read_axis",
        "nc_read_axis_many",
        "nc_read_error",
        "io_list_groups",
        "io_read",
        "io_read_many",
        "io_read_group",
        "tc_state",
        "tc_event_list",
        "tc_runtime_error_list",
        "tc_log_read",
        "tc_diagnose_errors",
        "tc_diagnose_runtime",
      ]),
    );
  });
});
