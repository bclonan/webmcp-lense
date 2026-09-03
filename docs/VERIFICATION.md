# Verification record

Verified locally on Windows on September 2, 2026.

| Gate | Final result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm build` | Passed, including Vue/TypeScript checking and production bundling |
| `pnpm test` | 49 passed, including sequential live sessions, cancellation, platform shortcut rejection, clipboard boundaries and visual change detection |
| Browser tests | 11 workflow/layout checks passed; all 7 guided-session checks passed on their final rerun after updating the platform-neutral heading expectation |
| `pnpm test:bridge` | 8 passed in the default target directory, including physical Windows monitor enumeration |
| Rust debug build and `cargo check --tests` | Passed after all companion changes |
| Rust cross-target checks | `cargo check --tests` passed for Apple Silicon macOS and x86_64 Linux; does not link or exercise native input |
| Rust release build | Current Windows build failed at the link/copy step for `target/release/lens-bridge.exe`, reporting Access is denied. Retrying outside the sandbox did not resolve it. No release pass claimed. |
| Git whitespace check | Passed across all added files |
| Native companion startup | Bound loopback, registered Ctrl+Alt+F10, printed pairing prompt |
| Console stop/rearm/quit | Passed using controlled stdin; no desktop input sent |
| Native WebMCP | All 19 tools discovered in the Codex in-app browser |
| Native WebMCP sequence and rerun | Two-step focus/type sequence completed on the demo desktop. Explicit rerun completed with a fresh goal ID and appended the text again. |
| Native WebMCP Paint goal | Completed; four visible strokes produced the house and sun |
| Native WebMCP Notepad goal | Completed; observation and preview contained `The house is finished.` |
| Mobile UI | All six routes fit a 390-pixel viewport without script errors |

The browser suite verifies approval before fictional claim submission, STOP with a pending approval, recording/replay/edit/export, capture initiation and track cleanup, and reload without control authorization. New checks cover setup with three monitor choices, two independently approved steps, keeping one pairing across navigation and rerun, recovery after an unverified action, clipboard review and user-clicked copy, and mobile modal focus restoration. Live capture and clipboard tests use substitutes; no real OS input or clipboard access occurs in those tests. Native tool discovery and the demo sequence above ran in the actual Codex in-app browser.

Rust transport tests use a substitute input backend. A live WebMCP click, approved in Lens, opened VS Code's File menu on the user's center monitor. The monitor mapping was x 0, y 0, width 1920, height 1080, and the screenshot confirmed the menu opened. The original whole-frame detector missed that small change and timed out. The detector now compares 8 by 8 tiles in a 128 by 72 sample. Regression tests cover a small dark menu, a short text line, unchanged frames, pixel noise, a caret sample, and capture reset. A live retry of the updated detector is still pending. Windows text entry, dragging and the emergency hotkey's physical keypress remain manual acceptance checks described in `BRIDGE.md`.

Earlier test runs failed with `LNK1104` in the separate `target/verification` directory. The current default-directory run passes all eight tests, so `pnpm test:bridge` now uses Cargo's normal target directory. No security protections or file permissions changed. The current debug companion build succeeds; the release output-copy failure is recorded above. Start the updated companion with the setup modal's command.

The visual sampler now primes its baseline immediately and polls the current decoded frame on a timer. The browser regression reproduced a static capture stream with a small menu update that the previous frame-callback-only sampler missed. That regression now passes. Ordinary failures retain pairing but stop subsequent actions; native execution failures, explicit STOP, capture loss and expiry revoke control.

The dependency install used Node's system certificate store to resolve the local certificate-chain error. TLS verification remains enabled. There is no repository TLS override.

Production deployment on September 2, 2026 is ready at https://lens-webmcp.netlify.app, deploy `6a988b29cb3dc45214942076`. The direct `/session` route and its JavaScript/CSS assets returned HTTP 200 with the expected content types. The actual Codex in-app browser discovered all 19 WebMCP tools on the deployed page. Its Paint fixture goal completed all nine steps and produced four visible strokes. This checks the browser demo, not Windows Paint. The build and all five guided live-session browser tests passed after the hosted-origin setup command fix.

Opening real Windows Paint from the hosted page remains pending the user's screen-sharing and pairing actions. The earlier companion process is no longer running. No real vision provider is configured.

The platform update makes Workspace the default route and keeps a native/local WebMCP indicator, tool list and event timeline visible. Browser fixtures verify macOS and Linux capability parsing, Mac logical-coordinate mapping and key choices. Windows, macOS and Linux X11 share the same session and stop protocol. Physical Mac/Linux input and hotkey checks remain unverified on this Windows host. The new GitHub Actions platform build workflow has not run remotely.

The platform/workspace update is deployed as `6a98ccfa7e9b31010f21a908` at https://lens-webmcp.netlify.app. Opening `/` in the actual in-app browser resolved to `/session`; the screenshot showed the WebMCP indicator, tool list and timeline together. All 19 tools were discovered, including the CMD key schemas, and a native WebMCP `goal_status` call returned the idle, unauthorized session state. No sharing or pairing was granted during this check.
