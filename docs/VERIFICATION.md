# Windows download and new session, 2026-09-03

Production deploy `6a9909ba043c5fcb89595175` contains the built Windows x64 development preview and New session in Workspace. The button stops control and capture, cancels approvals, waits for an executing receipt, and starts an unauthorized fresh session. It keeps saved workflows and previous session history. Active recordings must be saved first. A history save failure leaves the old session visible with control stopped.

- `pnpm test`: 63 passed, including cancellation, late receipt isolation, recording retention and storage-failure recovery.
- `pnpm build`: passed Vue type checking and production bundling. Build ID `2026-09-03T05:44:04.673Z`, JavaScript `index-PaHxSq_Z.js`.
- Browser suite: 22 passed on the full run; the new-session scenario failed only because its setup helper expected zero earlier screen shares on the second session. After correcting that expectation, the targeted new-session rerun passed. All 23 scenarios have passed on the final application code. Download, catalog retry, mobile layout and existing approval workflows passed.
- Visual browser check: Workspace and the connection dialog show the Windows download and build label. The deployed New session button returned the workspace to idle, disconnected and unauthorized. Native WebMCP still exposed 19 tools.
- `node --use-system-ca scripts/verify-bridge-downloads.mjs https://lens-webmcp.netlify.app` downloaded the production EXE and matched its size and SHA-256 with the staged file.

The artifact is `Lens-Bridge-0.2.1-windows-x64-development.exe`, 11,082,240 bytes. SHA-256: `d8418748fa8be8662182bb30aa64b9b48f41a91252e664b5bea207bf7e15d132`. It is the previously built and launched development executable. This turn copied and checksum-verified it; it did not rebuild native code or launch the downloaded copy. No native OS input was sent. The Windows release-output and CI billing blockers remain unresolved, and macOS/Linux downloads remain unavailable.

Earlier entries below record previous deployments.

---

# Pairing recovery patch, 2026-09-02

The current browser build and local development companion fix the old-tab pairing failure shown as `Error: [object Object]`. The old page omitted `protocolVersion`; Bridge 0.2.1 now rejects that request with a readable reload message. It does not consume the code or accept the old protocol. Versioned clients keep structured errors.

The browser extracts structured and legacy errors, offers reload guidance, retries temporary capability checks once, and ignores responses from disconnected sessions. Pairing and native input never retry automatically. A lost input response tells the user the action may already have happened. New deployments expose a build marker and show a user-clicked update banner in already-open tabs running this patch.

Verified on the final code:

- `pnpm test`: 60 passed.
- `pnpm test:e2e`: all 20 passed in the final full run. New cases cover pairing error recovery and update notices without interrupting sharing.
- Rust tests: 10 passed. The real HTTP server test rejects an unversioned pair without consuming the code, then completes the versioned pairing and command sequence using fake input.
- `cargo clippy --locked --manifest-path apps/bridge/Cargo.toml --all-targets -- -D warnings`, Rust formatting, and `pnpm build` passed.
- The Windows development build succeeded. The rebuilt 0.2.1 companion has a responsive Lens Bridge window and uses the production origin. A real unversioned request to that process returned HTTP 400, `errorCode: protocol_mismatch`, and a readable string explaining how to reload. No OS input was sent.
- Windows release output copying still fails with Access is denied, OS error 5. This patch does not claim a packaged native release or a downloaded launch test. The previously recorded CI billing blocker remains unresolved.

Production deploy `6a98ef343b8aa54b98d6daf2` is live at https://lens-webmcp.netlify.app. The hosted `/setup` returned HTTP 200 and bundle `index-Dk8nBfNu.js`. Its cache policy is `must-revalidate, no-cache, max-age=0`. `/app-version.json` returned build ID `2026-09-03T03:49:01.539Z`, protocol 1 and `Cache-Control: no-store`.

The actual in-app browser loaded the deployed setup dialog, then showed Workspace with all 19 native WebMCP tools and the event timeline. `goal_status` returned idle, disconnected and unauthorized. Actual screen sharing, successful native pairing and approved OS input were not repeated in this patch verification.

---

# Companion release verification, 2026-09-02

This section records the earlier 0.2.0 release attempt. The patch status above is current.

The existing Rust bridge was reused. It now has a visible eframe application window and wire protocol 1. The web setup, optional download selectors, protocol adapter and documentation are deployed to https://lens-webmcp.netlify.app. Production deployment ID: `6a98eb42098bcec14f8e2e8f`.

## Release blockers

- GitHub Actions run https://github.com/bclonan/webmcp-lense/actions/runs/33711405243 did not start any jobs. GitHub's visible annotation says recent account payments failed or the spending limit needs to be increased. No CI package exists. No release tag or GitHub Release was published.
- Local `cargo build --locked --release --manifest-path apps/bridge/Cargo.toml` compiles/links but Cargo cannot link or copy `target/release/deps/lens_bridge.exe` to `target/release/lens-bridge.exe`: Access is denied, OS error 5. The same command fails outside the sandbox. No permissions or endpoint protection were changed.
- The release manifest intentionally has an empty artifacts array. The hosted manifest returned HTTP 200 with version 0.2.0, protocolVersion 1 and no downloads. Setup has no broken or fabricated download links.

| Platform | Artifact target | Native release build | Downloaded launch | Native pairing/input | Download verified |
| --- | --- | --- | --- | --- | --- |
| Windows x64 | EXE | Local final copy blocked; CI did not start | No | No for 0.2.0 | No |
| macOS arm64 | DMG containing app | CI did not start | No | No | No |
| macOS x64 | DMG containing app | CI did not start | No | No | No |
| Linux x64 | Ubuntu 24.04+ DEB | CI did not start | No | No | No |

## Checks completed

| Check | Exact command | Result |
| --- | --- | --- |
| Bridge format | `cargo fmt --manifest-path apps/bridge/Cargo.toml -- --check` | Passed |
| Bridge lint | `cargo clippy --locked --manifest-path apps/bridge/Cargo.toml --all-targets -- -D warnings` | Passed |
| Windows type check | `cargo check --manifest-path apps/bridge/Cargo.toml --locked` | Passed |
| macOS type/lint check | `cargo clippy --locked --manifest-path apps/bridge/Cargo.toml --target aarch64-apple-darwin --all-targets -- -D warnings` | Passed; cross-check only |
| Linux type/lint check | `cargo clippy --locked --manifest-path apps/bridge/Cargo.toml --target x86_64-unknown-linux-gnu --all-targets -- -D warnings` | Passed; cross-check only |
| Bridge tests | `cargo test --locked --manifest-path apps/bridge/Cargo.toml` | 10 passed |
| Windows development build | `cargo build --locked --manifest-path apps/bridge/Cargo.toml` | Passed |
| Windows release build | `cargo build --locked --release --manifest-path apps/bridge/Cargo.toml` | Failed at final output copy, OS error 5 |
| macOS/Linux release builds | Same release command on their native CI runners | Not run; account billing blocked startup |
| Web tests | `pnpm test` | 53 passed |
| Browser integration | `pnpm test:e2e` | All 18 passed on final full run |
| Web production build | `pnpm build` | Passed, including Vue type check |
| JSON schema export | `node --experimental-strip-types apps/web/scripts/export-schemas.mjs` | Passed |

The first browser run failed the Linux key-choice fixture and one recording workflow after source edits triggered development reload. The fixture now advertises platform-appropriate keys. The final uninterrupted full run passed all 18 checks.

The Windows development executable was launched for review. Process inspection outside the sandbox confirmed a responsive window titled Lens Bridge and an IPv4 listener on 127.0.0.1:47653. This is not a packaged-download launch test. Actual native pairing, approved mouse input, clean GUI shutdown and reconnect still need an interactive smoke test.

Rust HTTP tests exercise the real server with a fake input backend: exact origins, unauthorized clients, one-time and expired codes, capability exchange, coordinate move receipt, malformed and unsupported commands, duplicates, protocol mismatch, session mismatch, stale timestamps, changed display revision, disconnect, renew and stop. They send no OS input. Browser fixtures cover sequential approvals, rerun, monitor mapping, Mac/Linux capabilities, screen sharing and existing browser-only workflows.

## Hosted verification

- https://lens-webmcp.netlify.app/setup opens the existing setup modal at `/session?setup=desktop`.
- Windows, macOS, Apple silicon/Intel and Linux selectors work. Linux instructions state the X11 limitation. Unpublished packages remain unavailable.
- Native WebMCP discovery exposed 19 tools. `goal_status` returned idle, unauthorized and disconnected on the deployed page.
- https://lens-webmcp.netlify.app/bridge-releases.json returned the expected empty release manifest. No binary URL was claimed verified.
- The production bundle is `index-Dlc_veE2.js` with `index-DkNgr1il.css`.

To finish the release, resolve GitHub's account billing/spending restriction, build all four native packages, download the artifacts with their manifests, run `pnpm stage:bridge`, build/deploy the web app, and run `node --use-system-ca scripts/verify-bridge-downloads.mjs https://lens-webmcp.netlify.app`. Then smoke-test the actual downloaded applications on available native systems. No debug binary should substitute for a release package.

---
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
