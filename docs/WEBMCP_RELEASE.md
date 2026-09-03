# WebMCP and hackathon pages

Deployed September 3, 2026 to the existing Netlify project. Deployment `6a9914dd0afafdbcb23b30d9`; build `2026-09-03T06:32:51.916Z`.

## Routes and behavior

- [WebMCP](https://lens-webmcp.netlify.app/webmcp) contains all 19 tools from the runtime registry, schemas, examples, state and recovery notes, ten prompt groups, five multi-tool chains and a live inspector. Read-only examples can run; mutating examples only validate in a preview.
- [Hackathon](https://lens-webmcp.netlify.app/hackathon) contains the project overview, actual architecture, feature prompts, comparison, contribution guide, submission checklist, visible MIT license and a 2:50 narrated video script.
- `/tools` redirects to `/webmcp`. Workspace remains the default route. Native tool registration stays in the application shell. Existing pairing, approvals, bridge download and New session behavior remain available.

## Files created

| Area                                     | Files                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages                                    | `apps/web/src/pages/WebMcpPage.vue`, `HackathonPage.vue`                                                                                                       |
| Styling                                  | `apps/web/src/app/docs.css`                                                                                                                                    |
| Documentation components                 | `apps/web/src/components/CopyButton.vue`, `WorkflowComparison.vue`, `WorkflowGuide.vue`, `VideoPreview.vue`                                                    |
| Shared content                           | `apps/web/src/content/toolDocs.ts`, `workflows.ts`, `project.json`, `video.ts`, `metadata.ts`, `demo-video-script.json`                                        |
| Brand assets                             | `apps/web/public/favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `og-image.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest`, `asset-licenses.txt` |
| Repository documentation                 | `LICENSE`, `CONTRIBUTING.md`, `docs/ASSETS.md`, `docs/demo-video-script.md`, this report                                                                       |
| Reproducible generation and verification | `scripts/generate-brand-assets.py`, `generate-demo-script.mjs`, `verify-documentation-deploy.mjs`                                                              |
| Tests                                    | `apps/web/tests/documentation.test.ts`, `apps/web/tests/e2e/documentation.spec.ts`                                                                             |

## Files modified or consolidated

- `apps/web/src/app/App.vue` and `main.ts` add navigation, routes, route metadata and document-entry scrolling.
- `apps/web/src/pages/ToolsPage.vue` was removed after its inspector was consolidated into WebMCP. No second registry was added.
- `apps/web/index.html` adds metadata and branded asset links without removing the viewport or entry script.
- `apps/web/package.json` and `pnpm-lock.yaml` add Ajv for independent JSON Schema example validation in tests.
- `apps/web/tests/e2e/lens.spec.ts` now checks the consolidated inspector and mutation preview.
- `README.md` and `docs/WEBMCP.md`, `ARCHITECTURE.md`, `DEMO.md`, `BRIDGE.md`, `DEPLOYMENT.md`, `VERIFICATION.md` document the current routes, actual capture behavior, public repository verification, setup and release evidence. The old manually maintained tool table was removed.

Earlier uncommitted bridge-download and New session changes were retained. This update did not replace the framework, Pinia stores, runtime, native adapter or Netlify configuration.

## Validation

68 web unit tests, 10 Rust tests, Rust formatting and Clippy passed. The full 27-scenario browser suite passed. A final tablet spacing adjustment was followed by all four documentation browser tests passing across five widths, 320 through 1440 pixels. The final build passed Vue type checking. No JavaScript lint command is configured. `git diff --check` passed.

The live browser discovered all 19 WebMCP tools, retained a working status handle across navigation, and completed the Paint fixture with four visible strokes. Desktop and mobile page checks found no horizontal overflow or browser errors. The legacy route redirected correctly. All referenced production assets matched local SHA-256 hashes, and the retained Windows bridge EXE matched its release catalog. Detailed evidence is in [VERIFICATION.md](VERIFICATION.md).

## Remaining work

`apps/web/src/content/project.json` contains the verified live and public GitHub URLs. `[YOUTUBE_URL]` remains a placeholder. Record the 386-word script, upload a public video with audio and configure its URL. The script lasts about 2:50 at 136 spoken words per minute; no recording has been produced or uploaded.

Publish the current source, assets and newly added MIT `LICENSE` to the public repository. No pre-existing license was replaced. The site shows the license text, but its source-publication checklist remains pending because these changes have not been committed or pushed.

Native limitations remain as documented. Windows has an unsigned development preview; macOS and Linux downloads are not published, and live semantic vision is unconfigured. These documentation and fixture checks do not establish real operating-system input on those platforms. Branding regeneration currently uses Pillow and Windows Segoe UI fonts; ordinary web builds use the committed assets.
