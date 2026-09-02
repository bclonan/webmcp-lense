# Verification record

Verified locally on Windows on September 2, 2026.

| Gate | Final result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm build` | Passed, including Vue/TypeScript checking and production bundling |
| `pnpm test` | 35 passed, including five live visual-change regression tests |
| `pnpm test:e2e` | 10 passed in 1.1 minutes after the visual-change fix |
| `pnpm test:bridge` | 6 passed |
| Rust release build | Passed |
| Git whitespace check | Passed across all added files |
| Native companion startup | Bound loopback, registered Ctrl+Alt+F10, printed pairing prompt |
| Console stop/rearm/quit | Passed using controlled stdin; no desktop input sent |
| Native WebMCP | All 15 tools discovered in the Codex in-app browser |
| Native WebMCP Paint goal | Completed; four visible strokes produced the house and sun |
| Native WebMCP Notepad goal | Completed; observation and preview contained `The house is finished.` |
| Mobile UI | All six routes fit a 390-pixel viewport without script errors |

The browser suite verifies approval before fictional claim submission, STOP with a pending approval, recording/replay/edit/export, capture initiation and track cleanup, and reload without control authorization. Its screen-capture test uses a canvas stream, not a real browser permission grant. The native-registration unit/browser fixtures are separate from the actual in-app browser discovery and goal runs above.

Rust transport tests use a substitute input backend. A live WebMCP click, approved in Lens, opened VS Code's File menu on the user's center monitor. The monitor mapping was x 0, y 0, width 1920, height 1080, and the screenshot confirmed the menu opened. The original whole-frame detector missed that small change and timed out. The detector now compares 8 by 8 tiles in a 128 by 72 sample. Regression tests cover a small dark menu, a short text line, unchanged frames, pixel noise, a caret sample, and capture reset. A live retry of the updated detector is still pending. Windows text entry, dragging and the emergency hotkey's physical keypress remain manual acceptance checks described in `BRIDGE.md`.

The root bridge test command uses a separate `target/verification` directory because Windows denied access to an earlier test output in the default directory. No security protections or access permissions were changed. During the live walkthrough, the native companion and web development server remain running. Failed live actions revoke bridge authorization and require a fresh pairing code.

The dependency install used Node's system certificate store to resolve the local certificate-chain error. TLS verification remains enabled. There is no repository TLS override.

No deployment or real vision provider was configured.
