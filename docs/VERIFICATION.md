# Verification record

Verified locally on Windows on September 2, 2026.

| Gate | Final result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm build` | Passed, including Vue/TypeScript checking and production bundling |
| `pnpm test` | 30 passed |
| `pnpm test:e2e` | 10 passed in 49 seconds |
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

Rust transport tests use a substitute input backend. The Windows backend compiled, and the native startup/console checks ran, but no automated check clicked, dragged or typed into real Paint or Notepad. Physical display mapping, actual Windows key delivery and the emergency hotkey's physical keypress remain manual acceptance checks described in `BRIDGE.md`.

The root bridge test command uses a separate `target/verification` directory because Windows denied access to an earlier test output in the default directory. No security protections or access permissions were changed. The native companion was stopped after verification. Only the web development server remains running.

The dependency install used Node's system certificate store to resolve the local certificate-chain error. TLS verification remains enabled. There is no repository TLS override.

No deployment or real vision provider was configured.
