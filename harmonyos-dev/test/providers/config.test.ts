import { describe, it, expect, beforeEach } from "vitest";
import {
  apiLevel,
  hvigorVersion,
  compatibleSdk,
  devManage,
  sdkPath,
  hdcPath,
  nodeMajor,
  jdkMajor,
} from "../../src/providers/config.js";

beforeEach(() => {
  process.env.HARMONYOS_PLUGIN_API_LEVEL = "12";
  process.env.HARMONYOS_PLUGIN_HVIGOR_VERSION = "4.0.2";
  process.env.HARMONYOS_PLUGIN_COMPATIBLE_SDK = "5.0.0";
  process.env.HARMONYOS_PLUGIN_DEV_MANAGE = "true";
  process.env.HARMONYOS_PLUGIN_SDK_PATH = "/sdk";
  process.env.HARMONYOS_PLUGIN_HDC_PATH = "/sdk/hdc";
  process.env.HARMONYOS_PLUGIN_NODE_MAJOR = "18";
  process.env.HARMONYOS_PLUGIN_JDK_MAJOR = "17";
});

describe("config", () => {
  it("reads env defaults", () => {
    expect(apiLevel()).toBe("12");
    expect(hvigorVersion()).toBe("4.0.2");
    expect(compatibleSdk()).toBe("5.0.0");
    expect(devManage()).toBe(true);
    expect(sdkPath()).toBe("/sdk");
    expect(hdcPath()).toBe("/sdk/hdc");
    expect(nodeMajor()).toBe("18");
    expect(jdkMajor()).toBe("17");
  });

  it("uses fallback when env unset", () => {
    delete process.env.HARMONYOS_PLUGIN_API_LEVEL;
    expect(apiLevel()).toBe("12");
  });

  it("dev_manage parses truthy", () => {
    process.env.HARMONYOS_PLUGIN_DEV_MANAGE = "false";
    expect(devManage()).toBe(false);
  });
});
