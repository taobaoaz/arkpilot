// src/providers/config.ts
function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

export const apiLevel = () => env("HARMONYOS_PLUGIN_API_LEVEL", "12");
export const hvigorVersion = () => env("HARMONYOS_PLUGIN_HVIGOR_VERSION", "4.0.2");
export const compatibleSdk = () => env("HARMONYOS_PLUGIN_COMPATIBLE_SDK", "5.0.0");
export const sdkPath = () => env("HARMONYOS_PLUGIN_SDK_PATH", "");
export const hdcPath = () => env("HARMONYOS_PLUGIN_HDC_PATH", "");
export const nodeMajor = () => env("HARMONYOS_PLUGIN_NODE_MAJOR", "18");
export const jdkMajor = () => env("HARMONYOS_PLUGIN_JDK_MAJOR", "17");
export function devManage(): boolean {
  const v = env("HARMONYOS_PLUGIN_DEV_MANAGE", "true").toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
