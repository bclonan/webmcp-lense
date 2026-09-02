# Lens

Turn any screen into an agent-addressable interface.

Lens is a local-first Vue app that connects screen observation, bounded desktop actions, human approvals and a readable event log. Its deterministic desktop demos run without an API key or native installation.

## Run the app

Requires Node.js 22.12 or newer and pnpm 11.8.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5176. Choose **Run Demo**, then Paint, Notepad or Claims. A demo button explicitly enables mock control and starts its goal. The Workspace also has a separate enable control button.

```sh
pnpm build
pnpm test
pnpm --filter @lens/web exec playwright install chromium
pnpm test:e2e
```

`pnpm dev:web` starts only the web app. `apps/web/dist` is a static site. Configure a static host to serve `index.html` for application routes. Fonts ship with the site. The app has no remote data service, telemetry or model dependency.

## Windows companion

Install stable Rust with the Windows MSVC toolchain and Visual Studio C++ Build Tools, then run in a visible terminal:

```sh
pnpm dev:bridge
```

The companion binds to `127.0.0.1:47653`. It accepts the exact browser origin `http://127.0.0.1:5176`. A different dev port or static origin requires an explicit override:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin http://127.0.0.1:5178
cargo test --manifest-path apps/bridge/Cargo.toml
cargo build --release --manifest-path apps/bridge/Cargo.toml
```

In Workspace, press **Share Screen** and choose a screen or window in the browser dialog. Enter the companion's one-time pairing code, then confirm the capture mapping in physical desktop pixels. Pairing expires after 30 minutes and never survives a browser reload in the app.

Press **STOP CONTROL**, use **Ctrl+Alt+F10**, or type `stop` in the bridge console to disable input. Type `enable` in that console to issue a new pairing code. Restarting control requires pairing again. Run without administrator privileges.

## What works

- Paint draws a house and sun through four real mock pointer paths. Notepad receives text through keyboard commands. Claims pauses before its fictional submission.
- One deterministic runtime owns planning, target resolution, policy, approval, execution, observation and verification. UI and WebMCP share its services.
- Live capture attaches a MediaStream to video and samples local visual differences. It stops tracks when sharing ends or the user leaves Workspace.
- Fifteen strict WebMCP tools register through `document.modelContext.registerTool` when available. The Tools inspector remains usable without native WebMCP.
- IndexedDB stores session events, settings and capability cartridges. Screenshots and video are never persisted. Credentials remain in memory.
- Record successful Lens actions, add notes, edit validated cartridge JSON, substitute `{{claimNumber}}`, replay through policy checks, and export JSON.
- The Evals page runs twelve isolated deterministic checks with visible PASS or FAIL results. Browser tests cover complete workflows and responsive layouts.

## Real Paint and Notepad

The Windows input companion is implemented. Real semantic vision and autonomous live planning are not bundled. Live observations are labeled `unavailable`, and the deterministic planner refuses live screens. Use the reviewed action composer to attempt individual inputs on Paint or Notepad. Follow the [native walkthrough](docs/BRIDGE.md#manual-paint-and-notepad-check).

Keyboard actions have a three-second pause after approval so you can focus the intended application. Clicks and drags use the confirmed capture mapping. Window movement, resizing, monitor changes and DPI changes require a fresh mapping. Prefer sharing one monitor and keeping its layout fixed.

## Repository

```text
apps/web          Vue, Pinia, browser services, UI, unit and browser tests
apps/bridge       Rust loopback transport and replaceable Windows input backend
packages/protocol Shared TypeScript domain and command types
packages/schemas  Strict runtime validators and cartridge schema
packages/fixtures Deterministic desktop states and scenarios
docs              Architecture, security, WebMCP, protocol, bridge, demo and eval guides
```

## Boundaries and limitations

Screen sharing requires browser permission. Native input requires pairing, an exact allowed origin and an allowlisted message. The bridge has no shell, file API, process-launch API, remote binding or elevation path. It refuses secure desktops. Policy runs in the browser and asks for consequential actions. All live clicks, drags and keyboard actions require review because real vision is absent.

This is an MVP, not a hardened security boundary against a compromised authorized page or local process. Keyboard input can change application data. Review the target, keep the emergency hotkey available and use fictional data. Live verification detects pixel changes; it cannot prove a semantic outcome without a provider. Native input on real Paint/Notepad needs a manual check on your display setup.

Read [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [WebMCP](docs/WEBMCP.md), [protocol](docs/PROTOCOL.md), [demo script](docs/DEMO.md) and [verification](docs/EVALS.md).
