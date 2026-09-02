# WebMCP

Lens uses the [current WebMCP imperative draft](https://webmachinelearning.github.io/webmcp/), checked on September 2, 2026. The adapter detects `document.modelContext.registerTool`, registers each tool with an AbortSignal and removes those registrations by aborting on unload or hot reload. Registration failure rolls back the batch and leaves local tools available. No deprecated `navigator.modelContext` compatibility path is assumed.

The canonical tool registry is browser-independent. Native WebMCP and the Tools page call the same strict handler, which calls `LensService`. The runtime performs policy checks and waits for the same visible approval controls. Tools cannot pair the bridge, start screen capture, enable control or grant approvals.

## Tools

All object schemas disallow additional properties. Input and output validators run even if the browser itself does not enforce JSON Schema. Inspect the exact schema, example, last input, last result and timestamp on `/tools`.

| Tool                       | Input example                                                              | Purpose and result                                                                                   |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `screen_get_context`       | `{}`                                                                       | Fresh normalized observation including source, size, revision and regions                            |
| `screen_locate`            | `{ "query": "canvas" }`                                                    | Find matching current region labels, text or IDs; returns observation ID and matches                 |
| `desktop_click`            | `{ "targetId": "visual:start" }`                                           | Propose a semantic click. Exactly one `targetId` or normalized `point`; optional left/right `button` |
| `desktop_type`             | `{ "text": "The house is finished." }`                                     | Propose 1 to 2000 characters into the focused field                                                  |
| `desktop_press`            | `{ "key": "WIN" }`                                                         | Propose one supported key or combination                                                             |
| `desktop_scroll`           | `{ "delta": -120 }`                                                        | Propose integer scroll of -1200 to 1200 native wheel units                                           |
| `desktop_drag`             | `{ "points": [{"x":0.3,"y":0.55},{"x":0.6,"y":0.55}], "durationMs": 600 }` | Propose 2 to 128 normalized points over 50 to 5000 milliseconds                                      |
| `screen_wait_for`          | `{ "text": "Paint open", "timeoutMs": 4000 }`                              | Wait at most 10 seconds for observed semantic text. Returns matching observation or a timeout        |
| `goal_start`               | `{ "goal": "Open Paint and draw a small house with a sun." }`              | Start a supported bounded demo goal after visible enablement                                         |
| `goal_status`              | `{}`                                                                       | Read runtime state, goal, authorization and pending-approval status                                  |
| `goal_cancel`              | `{}`                                                                       | Cancel pending work. Live mode also revokes desktop actuation                                        |
| `session_get_events`       | `{ "limit": 20 }`                                                          | Read up to 200 event summaries. Supply `after` with a previous event ID for the next page            |
| `workflow_start_recording` | `{}`                                                                       | Record successful Lens actions and declared notes                                                    |
| `workflow_stop_recording`  | `{ "name": "My Paint workflow" }`                                          | End a settled recording and persist its validated cartridge locally                                  |
| `capability_export`        | `{ "id": "lens-claims-v1" }`                                               | Return cartridge JSON. A file download occurs only through the visible Export button                 |

The six action and goal-entry tools return an acceptance receipt. Acceptance does not mean the goal succeeded. Use `goal_status` and `session_get_events` to observe completion, failure, cancellation or approval requirements. A missing target, uncalibrated live pointer, unsupported goal, failed assertion, stale approval or bridge error ends the runtime safely.

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

1. Run `pnpm dev`, then open Lens in a browser that implements the current imperative API.
2. Open Workspace. The status strip should say **Native WebMCP**. If it says **Local tools**, normal app functions and the inspector still work.
3. Press **Enable demo control**. The screen and bridge are both mock, and observation reports `fixture`.
4. Discover the tools with your browser's agent. Call `screen_get_context`, then `goal_start` with the Paint goal.
5. Read `goal_status` until the bounded run settles. Check the visible drawing and event receipts.
6. Start the Claims demo and verify that the agent receives a pending-approval state. Only a person clicking Approve action can resolve it.

The in-app browser can discover these tools directly. No extension, polyfill or API key is required for the local inspector. WebMCP remains an evolving draft; compatibility belongs in `nativeAdapter.ts`.
