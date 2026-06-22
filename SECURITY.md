# Security policy

## Supported versions

| Version | Supported |
|---|---|
| `v0.2.x` | ✅ active |
| `v0.1.x` | ⚠️ critical fixes only |
| `< v0.1.0` | ❌ no longer supported |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately by email:

> **taobaoaz (at) users.noreply.github.com**
>
> (Replace `(at)` with `@`. The address is the GitHub `noreply` alias that maps to the `taobaoaz` account, so replies route through GitHub's authenticated-email relay and do not expose a personal address.)

If you cannot use email, open a **GitHub Security Advisory** draft through the
[repository's Security tab](https://github.com/taobaoaz/arkpilot/security/advisories/new)
instead — that path is also private and is preferred over a plain issue.

## What to include

A good report makes our job easier and gets you a faster fix. Please include:

- The plugin version (`@zcode/harmonyos-dev-plugin` from `package.json`)
- The exact MCP tool name (e.g. `appstore_search`, `harmony_build_app`) and the
  arguments you passed (with secrets redacted)
- The HarmonyOS / DevEco / Node version, and the OS you're running on
- A minimal repro: command(s) or skill prompt that triggers the bug
- What you expected vs. what happened
- Any public CVE / advisory reference, if applicable

## Response timeline

| Stage | Target |
|---|---|
| Acknowledgement | within 7 days |
| Triage decision | within 14 days |
| Patch (critical / high) | within 30 days |
| Patch (medium / low) | next regular release |

## Scope of this policy

This policy covers:

- The `harmonyos-dev/` plugin source, build artifacts, and the published
  `apps.json` dataset.
- The 30 MCP tools registered in `src/mcp/server.ts` (25 `harmony_*` and 5
  `appstore_*`).
- The `AppGallery Crawl` GitHub Actions workflow and the data it publishes.

It does **not** cover:

- The HarmonyOS NEXT platform itself or Huawei's AppGallery backend. Issues
  in those upstream systems should be reported to Huawei.
- The user's own machine environment, JDK, Node, or hvigor install.
