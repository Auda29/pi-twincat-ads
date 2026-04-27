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
    expect(config.readOnly).toBe(true);
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
