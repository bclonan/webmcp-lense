# Lens

Turn any screen into an agent-addressable interface.

Lens is a local-first Vue app that connects screen observation, bounded desktop actions, human approvals and a readable event log. Its deterministic desktop demos run without an API key or native installation.

Open the [hosted Lens app](https://lens-webmcp.netlify.app). Netlify serves the browser app; Windows input still requires the local companion and screen sharing. See the [deployment guide](docs/DEPLOYMENT.md).

## Run the app

Requires Node.js 22.12 or newer and pnpm 11.8.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5176. Lens opens Workspace by default, with WebMCP status, its tool list and the event timeline visible. Call a tool there without leaving the shared view. The Demos tab offers Paint, Notepad and Claims. The introduction remains at `/about`.

```sh
pnpm build
pnpm test
pnpm --filter @lens/web exec playwright install chromium
pnpm test:e2e
```

`pnpm dev:web` starts only the web app. `apps/web/dist` is a static site. Configure a static host to serve `index.html` for application routes. Fonts ship with the site. The app has no remote data service, telemetry or model dependency.

## Desktop companion

Install stable Rust and your platform's build tools, then run in a visible terminal:

```sh
pnpm dev:bridge
```

Windows uses MSVC and Visual Studio C++ Build Tools. Mac uses Xcode Command Line Tools and requires Accessibility permission for the terminal or VS Code running Lens. Linux requires an X11 graphical session and libxkbcommon development files. Wayland input is not implemented. See the [platform setup guide](docs/PLATFORMS.md).

The companion binds to `127.0.0.1:47653`. It accepts the exact browser origin `http://127.0.0.1:5176`. A different dev port or static origin requires an explicit override:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin http://127.0.0.1:5178
cargo test --manifest-path apps/bridge/Cargo.toml
cargo build --release --manifest-path apps/bridge/Cargo.toml
```

In Workspace, press **Desktop setup**. The modal walks through sharing one monitor, starting the companion, entering its one-time pairing code, and choosing the shared monitor from the Windows display list. Lens remembers capture bounds as a suggestion, but asks for confirmation on each new share. Pairing stays active across Lens pages and successive actions for up to 30 minutes. A browser reload requires a new share and pairing. See the [setup and browser access guide](docs/DESKTOP_SETUP.md).

Press **STOP CONTROL**, use **Ctrl+Alt+F10**, or type `stop` in the bridge console to disable input. Type `enable` in that console to issue a new pairing code. Restarting control requires pairing again. Run without administrator privileges.

## What works

- Paint draws a house and sun through four real mock pointer paths. Notepad receives text through keyboard commands. Claims pauses before its fictional submission.
- One deterministic runtime owns planning, target resolution, policy, approval, execution, observation and verification. UI and WebMCP share its services.
- Live capture compares small regions on a timer, including when the desktop is otherwise still. Sharing continues across Lens pages and stops when the user ends sharing or closes the page.
- Nineteen strict WebMCP tools register through `document.modelContext.registerTool` when available. The Tools inspector remains usable without native WebMCP.
- Build up to 20 ordered steps, review each requested action, and rerun explicitly from step 1. Ordinary failures stop the sequence while preserving pairing. Bridge failures and STOP revoke input.
- Read clipboard text into a local review panel with a click. Copy reviewed text, or propose typing it. Agents can propose clipboard writes; a visible button performs them.
- IndexedDB stores session events, settings and capability cartridges. Screenshots and video are never persisted. Credentials remain in memory.
- Record successful Lens actions, add notes, edit validated cartridge JSON, substitute `{{claimNumber}}`, replay through policy checks, and export JSON.
- The Evals page runs twelve isolated deterministic checks with visible PASS or FAIL results. Browser tests cover complete workflows and responsive layouts.

## Real Paint and Notepad

The desktop companion has Windows, macOS and Linux X11 backends. Real semantic vision and autonomous live planning are not bundled. Live observations are labeled `unavailable`, and the deterministic planner refuses live screens. Use the reviewed action composer for individual inputs or explicit sequences. Follow the [native walkthrough](docs/BRIDGE.md#manual-paint-and-notepad-check).

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
