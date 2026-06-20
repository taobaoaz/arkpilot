# HarmonyOS Environment Setup

Use this procedure only when `harmony_preflight` reports that the HarmonyOS development environment is not ready.

The goal is to make the environment ready with deterministic shell commands, then return to MCP tools.

## Configurable Defaults

The plugin manifest exposes the HarmonyOS API level, hvigor version, compatible SDK version,
and dev-manage flag as user config. ZCode passes those values to the MCP server as
`HARMONYOS_PLUGIN_*` environment variables, and `harmony_preflight` reports the effective defaults.

Use those configured values instead of inventing versions. The documented fallback defaults are:

- `HARMONYOS_PLUGIN_API_LEVEL=12`
- `HARMONYOS_PLUGIN_HVIGOR_VERSION=4.0.2`
- `HARMONYOS_PLUGIN_COMPATIBLE_SDK=5.0.0`
- `HARMONYOS_PLUGIN_DEV_MANAGE=true`
- `HARMONYOS_PLUGIN_NODE_MAJOR=18`
- `HARMONYOS_PLUGIN_JDK_MAJOR=17`

## Guardrails

- Use explicit long timeouts for install commands, normally 10-30 minutes.
- Do not run DevEco Studio installers, SDK package managers, or PowerShell installers in the background.
- Do not pipe long installer output through `tail` only; preserve logs when useful.
- If a command asks for a password, administrator permission, or license acceptance, stop and ask the user to complete or approve that step.
- After each setup phase, re-run `harmony_preflight` and continue from the latest result.

## Quick Fix: hvigorw / node Not Found

If `harmony_preflight` only reports `hvigorw` or `node` as `not found`, do not reinstall DevEco Studio.
Install or expose the missing tool, then re-run `harmony_preflight`.

If a project already has `hvigorw` or `hvigorw.bat`, it does not need global hvigor. node must still
be on `PATH` (≥ the configured major version) because hvigorw shells out to node.

## macOS

### Detect Current State

```bash
which node hdc hvigorw ohpm 2>&1
node -v
echo "HOS_SDK_HOME=$HOS_SDK_HOME"
```

### Install DevEco Studio + command-line-tools

Download DevEco Studio from the official Huawei developer site and drag to `/Applications`.
DevEco Studio bundles hdc, hvigorw, and the SDK under
`/Applications/DevEco Studio.app/Contents/sdk` and the command-line-tools.

After install, expose the tools on `PATH`:

```bash
DEVECO="/Applications/DevEco Studio.app/Contents"
echo 'export HOS_SDK_HOME="'$DEVECO'/sdk"' >> ~/.zshrc
echo 'export HDC_HOME="'$DEVECO'/toolchains/hdc"' >> ~/.zshrc
echo 'export PATH="'$DEVECO'/toolchains:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### node (≥ configured major version)

```bash
node -v || brew install node@18
```

### JAVA_HOME (≥ configured major version)

```bash
brew list openjdk@17 >/dev/null 2>&1 || brew install openjdk@17
echo 'export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"' >> ~/.zshrc
source ~/.zshrc
```

## Windows (PowerShell)

### Detect Current State

```powershell
Get-Command node,hdc,hvigorw,ohpm -ErrorAction SilentlyContinue
node -v
$env:HOS_SDK_HOME
```

### Install DevEco Studio + command-line-tools

```powershell
winget install --id Huawei.DevEcoStudio --exact --source winget --accept-source-agreements --accept-package-agreements --silent
```

After install, set SDK + tool PATH (adjust the install path to your machine):

```powershell
$deveco = "$env:LOCALAPPDATA\Huawei\DevEco Studio"
[Environment]::SetEnvironmentVariable("HOS_SDK_HOME", "$env:LOCALAPPDATA\Huawei\Sdk", "User")
[Environment]::SetEnvironmentVariable("HDC_HOME", "$deveco\sdk\toolchains\hdc", "User")
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";$deveco\sdk\toolchains"
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")
```

### node (≥ configured major version)

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements --silent
```

### JAVA_HOME (≥ configured major version)

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK --exact --source winget --accept-source-agreements --accept-package-agreements --silent
[Environment]::SetEnvironmentVariable("JAVA_HOME", "$env:ProgramFiles\Eclipse Adoptium\jdk-17.0.x-hotspot", "User")
```

### Emulator acceleration

If `harmony_preflight` reports emulator acceleration unavailable on Windows, ask the user to
enable virtualization/WHPX in Windows Features or finish DevEco Studio emulator setup in Device
Manager, then re-run `harmony_preflight`.
