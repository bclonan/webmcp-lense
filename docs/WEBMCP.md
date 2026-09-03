# WebMCP

Lens uses the [current WebMCP imperative draft](https://webmachinelearning.github.io/webmcp/), checked on September 2, 2026. The adapter detects `document.modelContext.registerTool`, registers each tool with an AbortSignal and removes those registrations by aborting on unload or hot reload. Registration failure rolls back the batch and leaves local tools available. No deprecated `navigator.modelContext` compatibility path is assumed.

The canonical tool registry is browser-independent. Native WebMCP and the local inspector call the same strict handler, which calls `LensService`. The runtime performs policy checks and waits for the same visible approval controls. Tools cannot pair the bridge, start screen capture, enable control or grant approvals.

## Catalog and documentation

The [live WebMCP page](https://lens-webmcp.netlify.app/webmcp) derives every card from the canonical definitions in `apps/web/src/webmcp/tools.ts`. There are 19 registered tools in this version. `/tools` redirects to `/webmcp`; the old inspector is consolidated there. The Workspace tool panel remains available beside the shared view and timeline.

`content/toolDocs.ts` combines the real names, descriptions, JSON Schemas, examples and read-only hints with editorial result examples, recovery guidance and prompts. It does not register any tools. New canonical definitions automatically appear. Contract tests reject invalid examples and browser tests compare the page's entire tool set with the registered handlers.

Every card shows required and optional input properties, progressive schema and result details, affected state, errors, source links and copy controls. Read-only tests call the same registry. All mutating examples open a validation preview and never execute from documentation. Continue in Workspace only navigates; it does not run the preview.

All object schemas disallow additional properties. Input and output validators run even if the browser does not enforce JSON Schema. `desktop_click` requires exactly one current target ID or normalized point. JSON Schema examples are independently checked with Ajv.

`content/workflows.ts` defines ten feature prompt groups and five chains with data dependencies, state changes, approval boundaries and partial-failure instructions. These guides and the old-way comparison are isolated documentation examples. Their steppers never send desktop input; operation counts in the comparison are explicitly illustrative.

Action and goal-entry tools return an acceptance receipt. Acceptance does not mean the goal succeeded. Use `goal_status` and `session_get_events` to observe completion, failure, cancellation or approval requirements. `goal_status` also reports `busy`, the current step and total, failure text, bridge status, screen sharing, and confirmed mapping. Do not issue another action while `busy` is true. An ordinary failure stops the sequence while retaining a healthy connection; bridge failures revoke control.

## Sequences, rerun, and browser APIs

Use `desktop_run_sequence` for 1 to 20 explicit ordered steps, `goal_rerun` only for a deliberate fresh run, `browser_get_capabilities` for an availability check and `browser_clipboard_propose_write` to prepare a visible copy proposal. Their current schemas and results are in the registry-backed catalog rather than a second manually maintained table.

Sequence steps use `click`, `type`, `press`, `scroll`, `drag`, `locate`, `waitFor` or `assert`. A click requires exactly one normalized `point` or current `targetId`. Live semantic assertions are unavailable without a vision provider. `CTRL+C` and pointer movement use an input receipt rather than requiring a visual change; clipboard content is not asserted.

`goal_cancel` retains pairing when it cancels pending approval or remaining work. Cancellation during native execution also stops the bridge. STOP always revokes control. Clipboard permission follows the browser's normal user-activation rules. There is no tool for silently reading the clipboard or controlling other browser tabs. See [desktop setup and browser access](DESKTOP_SETUP.md).

## Result envelope

```json
{
  "ok": true,
  "data": {
    "goalId": "01M1EXAMPLE",
    "status": "accepted",
    "message": "Inspect goal_status and the workspace. ASK actions wait for human approval."
  }
}
```

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input does not match the tool schema."
  }
}
```

Errors use `VALIDATION_ERROR`, `ACTION_ERROR` or `CANCELLED`. The registry validates each tool's successful data shape. Tool cancellation signals flow into runtime work and bounded waits. Asynchronously accepted goals also support the explicit `goal_cancel` tool. There is no mutation retry under a different API convention.

## Test native WebMCP

Workspace is the default route. The header reports whether native WebMCP is connected or only local tools are available. Its tools panel can invoke the same registered handlers without leaving Workspace; the event timeline remains beside it on desktop layouts. The WebMCP page exposes schemas, invocation details and safe read-only tests.

1. Run `pnpm dev`, then open Lens in a browser that implements the current imperative API.
2. Open Workspace. The status strip should say **Native WebMCP**. If it says **Local tools**, normal app functions and the inspector still work.
3. Press **Enable demo control**. The screen and bridge are both mock, and observation reports `fixture`.
4. Discover the tools with your browser's agent. Call `screen_get_context`, then `goal_start` with the Paint goal.
5. Read `goal_status` until the bounded run settles. Check the visible drawing and event receipts.
6. Start the Claims demo and verify that the agent receives a pending-approval state. Only a person clicking Approve action can resolve it.

The in-app browser can discover these tools directly. No extension, polyfill or API key is required for the local inspector. WebMCP remains an evolving draft; compatibility belongs in `nativeAdapter.ts`.

## Registration and shared state

Lens uses imperative JavaScript registration, not declarative HTML form annotations. `app/main.ts` registers the canonical tools once after service composition. Navigating between Workspace, WebMCP and Hackathon retains those registrations. `nativeAdapter.ts` supplies `readOnlyHint` and `untrustedContentHint`; it cleans up on page exit and hot reload. A registration failure aborts its batch and leaves the local inspector usable.

Handlers call `LensService`, which updates the same Pinia stores that render the interface. IndexedDB persistence stays behind `Repository`. Bounded tool waits accept cancellation signals; navigating away cancels a documentation-only wait without unregistering the application's tools. The live inspector shows availability, names, valid examples and the latest structured invocation.

To add a tool, schema, result example or chain, follow [CONTRIBUTING.md](../CONTRIBUTING.md). The implementation follows the [WebMCP draft](https://webmachinelearning.github.io/webmcp/) and the distinction between imperative and declarative tools in [Chrome's early-preview introduction](https://developer.chrome.com/blog/webmcp-epp). Availability depends on the browser and its enabled experimental capabilities; Lens feature-detects the actual API instead of assuming a browser version.
