import { describe, expect, it } from "vitest";

import {
  LOOPBACK_AMS_NET_ID,
  isWriteAllowed,
  normalizeTwinCatAdsConfig,
} from "../src/index.js";

describe("core config contract", () => {
  it("normalizes router-mode defaults", () => {
    const config = normalizeTwinCatAdsConfig({
      targetAmsNetId: "localhost",
    });

    expect(config.connectionMode).toBe("router");
    expect(config.targetAmsNetId).toBe(LOOPBACK_AMS_NET_ID);
    expect(config.targetAdsPort).toBe(851);
    expect(config.services.plc.targetAdsPort).toBe(851);
    expect(config.services.nc.targetAdsPort).toBe(500);
    expect(config.services.io.targetAdsPort).toBe(300);
    expect(config.readOnly).toBe(true);
  });

  it("normalizes named ADS services and PLC symbol groups", () => {
    const config = normalizeTwinCatAdsConfig({
      targetAmsNetId: "localhost",
      services: {
        plc: {
          targetAdsPort: 852,
          symbolGroups: {
            status: ["MAIN.ready", "MAIN.error"],
          },
        },
        nc: {
          targetAdsPort: 501,
          axes: [
            {
              name: "X",
              id: 1,
              description: "X axis",
            },
          ],
        },
        io: {
          targetAdsPort: 301,
          dataPoints: [
            {
              name: "Input1",
              indexGroup: 0xf020,
              indexOffset: 0x1f400,
              type: "bool",
            },
          ],
          groups: {
            inputs: ["Input1"],
          },
        },
      },
    });

    expect(config.targetAdsPort).toBe(852);
    expect(config.services.plc).toEqual({
      targetAdsPort: 852,
      symbolGroups: {
        status: ["MAIN.ready", "MAIN.error"],
      },
    });
    expect(config.services.nc).toEqual({
      targetAdsPort: 501,
      axes: [
        {
          name: "X",
          id: 1,
          description: "X axis",
        },
      ],
    });
    expect(config.services.io).toEqual({
      targetAdsPort: 301,
      dataPoints: [
        {
          name: "Input1",
          indexGroup: 0xf020,
          indexOffset: 0x1f400,
          type: "BOOL",
        },
      ],
      groups: {
        inputs: ["Input1"],
      },
    });
  });

  it("keeps writes behind readOnly and exact allowlist checks", () => {
    expect(
      isWriteAllowed(
        {
          readOnly: true,
          writeAllowlist: ["MAIN.xEnable"],
        },
        "MAIN.xEnable",
      ),
    ).toBe(false);

    expect(
      isWriteAllowed(
        {
          readOnly: false,
          writeAllowlist: ["MAIN.xEnable"],
        },
        "MAIN.xEnable",
      ),
    ).toBe(true);
  });
});
