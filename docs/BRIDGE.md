# Lens Bridge

The canonical companion is the existing Rust crate in `apps/bridge`. Version 0.2.0 adds an eframe native window around the same HTTP server and input backends. There is no second bridge, hosted native server or agent reasoning in the executable.

- `src/main.rs` starts the GUI.
- `src/gui.rs` owns visible setup, pairing state, pause/disconnect, new codes, quit and the in-memory local action log.
- `src/server.rs` owns loopback HTTP, strict origin/session checks, version negotiation, validation and receipts.
- `src/protocol.rs` defines bounded commands matching `packages/schemas/src/index.ts`.
- `src/session.rs` owns random secrets, expiry, replay protection and stop epochs.
- `src/windows_input.rs` uses Windows SendInput and monitor APIs.
- `src/unix_input.rs` uses Enigo on macOS and Linux X11, with native display enumeration.
- `src/emergency.rs` owns Ctrl+Alt+F10 registration. Closing/restarting the window releases the registration.

Transport is POST JSON over `http://127.0.0.1:47653`. The packaged app accepts only `https://lens-webmcp.netlify.app` by default. A user can explicitly change the exact origin in the native window. No tokens persist to disk. The latest 200 action metadata entries appear locally in the window; typed content and pairing secrets are excluded. The log clears when the process exits.

See [desktop setup](DESKTOP_SETUP.md), [protocol](PROTOCOL.md), [platforms](PLATFORMS.md) and [security](SECURITY.md).

## Contributor commands

```sh
pnpm dev:bridge
pnpm build:bridge
pnpm package:bridge
pnpm test:bridge
cargo fmt --manifest-path apps/bridge/Cargo.toml -- --check
cargo clippy --locked --manifest-path apps/bridge/Cargo.toml --all-targets -- -D warnings
```

`pnpm dev:bridge` opens the same GUI with the local web origin. An explicit origin also works:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin http://127.0.0.1:5178
```

## Native release process

`.github/workflows/bridge.yml` builds Windows x64, macOS arm64, macOS x64 and Ubuntu 24.04 x64 independently. Each job checks formatting, runs Clippy and tests, builds with Cargo.lock, and runs `scripts/package-bridge.mjs`. The packaging script reads the crate version and commit date, then writes a versioned EXE, DMG or DEB with a JSON SHA-256 manifest. Rust dependencies are locked; OS runner and toolchain updates can change resulting bytes between builds.

A `bridge-v0.2.0` tag triggers a GitHub Release only after all build jobs succeed. The private repository's release assets require authentication. Download the four CI artifacts or release packages to `release/packages`, preserving their manifests. Run:

```sh
pnpm stage:bridge
pnpm build
node --use-system-ca scripts/verify-bridge-downloads.mjs https://lens-webmcp.netlify.app
```

Run the verification command after deploying the built site. Staging rejects missing packages, mixed versions and checksum mismatches. It copies only release packages to the ignored `apps/web/public/downloads` directory and updates the centralized `bridge-releases.json`. Netlify publishes those files with the app. Do not substitute debug binaries or advertise URLs before verifying their bytes.

No publisher signing or Apple notarization is configured. Native release build and download status is recorded in [VERIFICATION.md](VERIFICATION.md).

## Manual Paint and Notepad check

1. Download the published Windows artifact and compare its SHA-256 with the setup dialog.
2. Open Lens Bridge. Confirm its website, visible pairing code and five-minute countdown.
3. Open desktop setup, share a monitor, pair and confirm the monitor mapping.
4. Use Test connection and verify version, device, commands and latency.
5. Propose pressing WIN. Approve, focus the desktop during the countdown, and confirm Start opens.
6. Propose typing Paint and then ENTER as separate steps. Approve each and confirm Paint opens. Use a blank drawing for bounded move/click/drag/scroll checks. Do not save over an existing file.
7. Use a new untitled Notepad document for typing and shortcut checks.
8. Disconnect, confirm old commands fail, issue a new code, and reconnect.
9. Press Ctrl+Alt+F10. Verify the next command fails. Close Lens Bridge and confirm port 47653 closes and no held input remains.

Automated protocol tests use a fake input backend. They do not count as native desktop or downloaded-package smoke tests.
