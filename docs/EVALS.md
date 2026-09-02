# Verification

Run the full browser gate from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm --filter @lens/web exec playwright install chromium
pnpm test:e2e
pnpm test:bridge
git diff --check
```

The browser suite starts an isolated Vite server on `127.0.0.1:5178`. It does not reuse or stop the development server. Install Chromium once if it is absent.

## In-app evaluations

The Evals page runs twelve named fixtures from `runtime/evals.ts`. The unit suite runs those same checks. They verify native registration through a substitute host, strict input schemas, semantic resolution, coordinates across negative monitor origins, ALLOW/ASK/BLOCK, approval-before-execution, cancellation, visual difference detection, Paint/Notepad completion and bridge failure.

These evaluations use isolated mock desktops and never send OS input. Results are actual assertions, not a fixed status list. The unit suite also checks concurrent goals, stale approvals, denial, external abort, forbidden commands, unsupported goals, coordinate endpoints, recorded replay, variable substitution, append-only storage and reload authorization.

## Browser tests

Playwright covers Paint and Notepad end-to-end, the Claims approval pause, STOP during approval, workflow recording/replay/edit/export, strict local tool calls, all twelve evals, native adapter registration through a test implementation, explicit capture initiation/track cleanup, and every route at a mobile viewport.

The capture lifecycle test substitutes a local canvas stream for `getDisplayMedia`. It verifies the service lifecycle without accepting or bypassing a real permission dialog. The native adapter test substitutes `document.modelContext`; actual native discovery is a separate browser check.

## Rust tests

Protocol tests reject unknown messages, unknown fields, out-of-bounds coordinates, excessive text/path durations and unsupported keys. Session tests verify one-time pairing, expiry and stop epochs. An HTTP test uses a substitute input backend to verify origin rejection, unauthenticated rejection, pairing, one admitted command, duplicate rejection, schema rejection and token revocation after STOP.

`cargo test` compiles the Windows input implementation on Windows, but does not actuate real applications. `cargo build --release --manifest-path apps/bridge/Cargo.toml` creates a release executable. Follow `BRIDGE.md` for the interactive Paint/Notepad and hotkey checks. Real Windows input, physical monitor mapping and browser permission dialogs are not proven by mock tests.

## Release record

See `VERIFICATION.md` for the final run results. A command receipt is evidence that the input backend accepted an action. Only the subsequent observation/assertion can establish the expected application outcome.
