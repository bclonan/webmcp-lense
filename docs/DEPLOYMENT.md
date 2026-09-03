# Netlify deployment

Production: https://lens-webmcp.netlify.app

Netlify project: `11208571-39b6-465e-981e-8cd12e0e4f43`

The root `netlify.toml` builds with `pnpm build`, publishes `apps/web/dist`, and rewrites application routes to `index.html`. This deployment uploaded a local build. Git-based automatic deployments are not configured.

To publish a later local build using an authenticated Netlify CLI:

```sh
pnpm build
netlify deploy --filter @lens/web --site 11208571-39b6-465e-981e-8cd12e0e4f43 --prod --no-build
```

## Windows companion for the hosted page

Run this from the repository root:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin https://lens-webmcp.netlify.app
```

The companion still listens only on `127.0.0.1:47653`. No native executable runs on Netlify. The setup modal shows the command for the current page origin. Use the production URL consistently. A deploy-preview URL has a different origin and requires its own companion command.

Choose the shared monitor, pair using the console code, and confirm its bounds in the setup modal. Browser restrictions may block hosted access to loopback or request local-network permission. If the browser blocks it, use the local app at `http://127.0.0.1:5176` and restart the companion with the default `pnpm dev:bridge` command. A reload requires new sharing and pairing.

The hosted Paint demo passed through native WebMCP. Real Windows Paint requires the interactive companion check described in [BRIDGE.md](BRIDGE.md#manual-paint-and-notepad-check).

## Companion download deployment, 0.2.0

Production deployment `6a98eb42098bcec14f8e2e8f` contains the new setup dialog and protocol adapter. `/setup` opens the existing desktop setup modal. The repository is private, so public binary links must use the Netlify-hosted copies of verified native release packages.

`apps/web/public/bridge-releases.json` is the centralized release catalog. It currently contains no artifacts because GitHub Actions cannot start while the account has a billing/spending restriction, and local Windows release output copying returns access denied. The website explicitly reports unavailable downloads. Never fill this catalog with guessed URLs.

The reproducible packaging and staging process is documented in BRIDGE.md. After staging four matching release manifests, build and deploy the app, then run the download verification script against the production origin. It downloads every advertised artifact and compares both size and SHA-256 with the staged manifests.
