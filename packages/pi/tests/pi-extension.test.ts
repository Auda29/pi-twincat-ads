import { describe, expect, it, vi } from "vitest";

import piTwinCatAdsExtension, { formatToolSuccess } from "../src/pi-extension.js";

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
        "nc_read_axis_position",
        "nc_read_axis_status",
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

  it("formats configured NC axes in the Pi host response text", () => {
    expect(
      formatToolSuccess("nc_list_axes", {
        count: 2,
        axes: [
          { name: "X1-TRAV", id: 1, targetAdsPort: 500 },
          {
            name: "Y1-BAB",
            id: 2,
            targetAdsPort: 500,
            description: "Y axis",
          },
        ],
      }),
    ).toBe(
      "Listed 2 configured NC axes: X1-TRAV (id 1, port 500); Y1-BAB (id 2, port 500, Y axis).",
    );
  });
});
