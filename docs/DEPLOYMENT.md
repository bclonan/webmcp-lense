# Netlify deployment

Production: https://lens-webmcp.netlify.app

Netlify project: `11208571-39b6-465e-981e-8cd12e0e4f43`

The current deployment is `6a9909ba043c5fcb89595175`, with build ID `2026-09-03T05:44:04.673Z`. It adds the Windows bridge development preview download and New session in Workspace. The production browser check and hosted EXE checksum verification passed.

Pages revalidate on load. `/app-version.json` is not cached. Tabs running this patch check the marker when visible and every minute, then offer Reload to update if the build changed. Updates never force a reload during screen sharing. Tabs from before this patch need one manual reload to receive the update checker.

The root `netlify.toml` builds with `pnpm build`, publishes `apps/web/dist`, and rewrites application routes to `index.html`. This deployment uploaded a local build. Git-based automatic deployments are not configured.

To publish a later local build using an authenticated Netlify CLI:

```sh
pnpm build
netlify deploy --filter @lens/web --site 11208571-39b6-465e-981e-8cd12e0e4f43 --prod --no-build
```

## Windows companion for the hosted page

Use Download Windows bridge beside Desktop setup or in the connection dialog. The current download is version 0.2.1, Windows x64, an unsigned development preview. It may open a console alongside the companion window. Keep both open. macOS and Linux downloads are not published.

Contributors can also run this from the repository root:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin https://lens-webmcp.netlify.app
```

The companion still listens only on `127.0.0.1:47653`. No native executable runs on Netlify. The setup modal shows the command for the current page origin. Use the production URL consistently. A deploy-preview URL has a different origin and requires its own companion command.

Choose the shared monitor, pair using the code in the companion window, and confirm its bounds in the setup modal. Browser restrictions may block hosted access to loopback or request local-network permission. If the browser blocks it, use the local app at `http://127.0.0.1:5176` and restart the companion with the default `pnpm dev:bridge` command. A reload requires new sharing and pairing.

The hosted Paint demo passed through native WebMCP. Real Windows Paint requires the interactive companion check described in [BRIDGE.md](BRIDGE.md#manual-paint-and-notepad-check).

## Companion download deployment, 0.2.0

Production deployment `6a98eb42098bcec14f8e2e8f` contains the new setup dialog and protocol adapter. `/setup` opens the existing desktop setup modal. The repository was private at that release attempt. It is public as verified on September 3, 2026. Binary links currently use Netlify-hosted copies of verified native packages.

`apps/web/public/bridge-releases.json` is the centralized release catalog. The 0.2.0 release attempt published no artifacts because GitHub Actions could not start while the account had a billing/spending restriction, and local Windows release output copying returned access denied. The current catalog contains one explicitly labeled Windows development preview. It does not claim that the four-platform release process passed.

The reproducible packaging and staging process is documented in BRIDGE.md. After staging four matching release manifests, build and deploy the app, then run the download verification script against the production origin. It downloads every advertised artifact and compares both size and SHA-256 with the staged manifests.

To restage the Windows development preview before a later web build:

```sh
cargo build --locked --manifest-path apps/bridge/Cargo.toml
node scripts/package-bridge.mjs --development
node scripts/stage-bridge-downloads.mjs --preview
pnpm build
```

The EXE is ignored by Git. Restage it before deploying from another checkout. After deployment, run `node --use-system-ca scripts/verify-bridge-downloads.mjs https://lens-webmcp.netlify.app`. Normal staging still requires all four release packages; `--preview` permits only the Windows x64 development build.
