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
