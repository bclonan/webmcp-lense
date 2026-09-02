# Security

Lens requires two separate user actions for live control. **Share Screen** opens the browser's capture permission dialog. **Pair bridge** submits a one-time code displayed by the companion. WebMCP cannot grant either permission, enable control, approve an action or confirm capture geometry.

## Native authorization

- The bridge binds IPv4 loopback `127.0.0.1:47653` only. There is no remote listener.
- Every request checks the exact configured Origin and Host. No wildcard CORS origins or ambient cookies are accepted.
- Pairing uses 128 bits of OS randomness. A successful pairing consumes the code and issues a 256-bit session token for 30 minutes. Five attempts per 30 seconds limit code guessing.
- Bearer tokens stay in browser memory and never enter IndexedDB, URLs, event history or cartridges.
- JSON requests must declare a body length of at most 16 KiB. Unknown fields and action types fail validation. Points, text, scroll amounts and path duration are bounded.
- Only one input action can run at a time. The bridge refuses concurrent actions and duplicate command IDs. It does not queue or retry mutations.
- STOP, disconnect and the native hotkey invalidate the session and in-flight execution epoch. Drag/text input checks cancellation between input samples, with drag checks about every 10 milliseconds. Pressed buttons and keys are released on the normal error/stop path.
- Rearming requires the visible native console command `enable`, then a fresh browser pairing. The bridge refuses startup if it cannot register Ctrl+Alt+F10.

## Input limits

The Windows backend uses `SendInput` with Unicode keyboard input and physical virtual-desktop coordinates. It requests per-monitor DPI awareness and checks that the input desktop is `Default`. The process never elevates itself, changes privileges or attempts to interact with a security desktop. Windows UIPI may reject input into higher-integrity applications. The bridge reports a failure instead of working around that restriction.

There is no shell execution, arbitrary code execution, process-launch endpoint or filesystem execution API. A key enum replaces arbitrary shortcut strings. Command strings are never interpreted as programs. Text is typed into the current focused application.

## Browser policy and stopping

The deterministic browser policy returns ALLOW, ASK or BLOCK. Consequential region metadata, submit/delete/send/purchase/save/close intent, and save/delete/paste/close shortcuts require approval. Known system-command and permission-bypass intent is blocked. Extension rules can add restrictions but cannot override a built-in block.

Every ASK produces a visible pending approval. Execution waits for that exact approval ID. A changed observation invalidates the approval. Cancellation removes pending work. STOP CONTROL stays visible while scrolling, cancels the runtime and disables bridge input while retaining history.

Because live semantic recognition is absent, live clicks, drags and keyboard input always require review. Keyboard input pauses three seconds after approval so the user can focus the intended application. Prefer a stable monitor capture; moving a window invalidates a manually entered mapping even if Lens cannot detect the movement.

## Data

Captured video and raw screenshots remain in memory and are never persisted. There is no screenshot-retention switch in this version. Tracks stop when the user ends sharing, leaves Workspace or unloads the page. Events can contain typed text and semantic observations, which stay in origin-local IndexedDB. Settings includes a read-only history viewer. Demo data is fictional.

The static app includes its fonts and makes no provider calls. A future remote vision adapter must disclose its data destination and obtain a separate opt-in before sending frames. A provider key must not be bundled into client code.

## Threat-model limits

Pairing authorizes an origin, not a trustworthy AI. A compromised authorized page or local process with a stolen token could bypass browser policy and issue supported input messages. The native bridge does not understand semantic intent. Keyword policy cannot classify every harmful sequence of clicks or keystrokes. It is not a sandbox against an already compromised host.

Emergency stop prevents later inputs; it cannot undo an action Windows already delivered. Browser unload cleanup is best effort, so the independent native hotkey remains available. The bridge token expires even if an unload request cannot reach it. Secure-desktop transitions and blocked Windows input can prevent key-release delivery; no privilege workaround is attempted. Use manual recovery if necessary.

Do not describe Lens as a way around browser or OS permission prompts.
