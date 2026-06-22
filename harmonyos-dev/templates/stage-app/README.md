# Stage App Template

The HarmonyOS plugin generates its minimal HarmonyOS NEXT Stage-model ArkTS project from
TypeScript templates in `src/providers/project.ts` (the `createApp` function writes files
inline using `{{BUNDLE_NAME}}` / `{{MODULE_NAME}}` variable substitution).

This directory is reserved for larger template assets if the generated project grows beyond
inline templates in a future version.
