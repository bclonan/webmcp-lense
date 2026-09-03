# Contributing to Lens

Use Node.js 22.12 or newer and pnpm 11.8. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Demos need no environment variables, model keys or native companion. Keep the existing Vue, Pinia and service boundaries. Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing runtime behavior.

## Add a tool

1. Add the behavior to `apps/web/src/app/LensService.ts` or its existing adapter. UI and agents must call the same operation. External providers belong behind `vision/VisionProvider.ts` or another explicit service adapter, never inside a page component. No remote provider ships today.
2. Add one definition to `apps/web/src/webmcp/tools.ts`. Use a unique domain-prefixed name such as `screen_get_context`, a purpose, a strict Zod input schema, a successful output schema, representative valid arguments, the correct read-only hint, and a handler. Shared protocol validators belong in `packages/schemas/src/index.ts`.
3. Preserve `ToolRegistry` validation and the `{ ok, data }` or `{ ok: false, error }` envelope. Honor cancellation signals. Input acceptance does not establish asynchronous goal completion. Keep pairing, capture, authorization and approval in visible human controls.
4. Add an example result, affected state, recovery guidance and optional curated prompt to `apps/web/src/content/toolDocs.ts`. Catalog membership and schemas come directly from the registry; do not add a separate tool array. Without an override, the prompt derives from the canonical name and arguments. A new incompatible output example fails the documentation test until supplied.
5. Add feature prompts or ordered workflows to `apps/web/src/content/workflows.ts`. Use real tool names and real result field dependencies. Explain state changes, conditional steps, approval and partial failure. Documentation previews never execute mutating tools.
6. Add handler tests under `apps/web/tests` and a browser scenario under `apps/web/tests/e2e` when behavior needs browser coverage. `documentation.test.ts` checks registry coverage, JSON Schema arguments, output examples, workflow references, video URLs and script synchronization.

`apps/web/src/app/main.ts` registers native tools at application startup. Route components must not register or unregister them. Compatibility with the evolving WebMCP browser API belongs in `nativeAdapter.ts`.

## Content and assets

- Update verified project links and the `[YOUTUBE_URL]` placeholder in `apps/web/src/content/project.json`. Keep readiness flags honest. A configured video URL alone does not prove its duration, public visibility or audio.
- Edit `apps/web/src/content/demo-video-script.json`, then run `node scripts/generate-demo-script.mjs`. The same six segments render on `/hackathon` and in `docs/demo-video-script.md`.
- See [ASSETS.md](docs/ASSETS.md) for icon and preview regeneration. Preserve third-party attribution.
- Publish new source, assets and `LICENSE` to the public repository before marking the submission checklist complete. No source commit or push occurs as part of the web deployment command.

## Check and release

```sh
pnpm --filter @lens/web exec playwright install chromium
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
git diff --check
```

There is no configured JavaScript lint command. For native changes, also run `pnpm test:bridge`, Rust formatting and Clippy as listed in the README. OS input tests need the separate reviewed manual setup in [BRIDGE.md](docs/BRIDGE.md).

Verify `/session`, `/webmcp` and `/hackathon` at desktop and mobile widths. Run a fixture workflow, check the event timeline and test a human approval. Confirm route changes preserve the native tool set. Follow the existing [Netlify deployment workflow](docs/DEPLOYMENT.md); retain the staged Windows download. Report hosted checks separately from local tests.
