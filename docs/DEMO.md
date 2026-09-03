# Extended demo walkthrough

For the narrated submission video, use [the 2:50 recording script](demo-video-script.md), also rendered on `/hackathon`. This longer walkthrough is for exploration.

Run `pnpm dev` and open http://127.0.0.1:5176. No model key, native companion or actual desktop permission is needed for this script. The claims data is fictional.

## One-minute opening

Say: "Lens makes a screen addressable through a small set of tools. The browser owns the loop. You can inspect what it sees, what it proposes and what actually happened."

1. Start in Workspace. Show Desktop setup, the fixture label, tool list and event timeline.
2. Open Demos, then choose **Run Paint demo**. This button explicitly enables mock control and begins the goal.
3. Watch Start search appear, Paint open and its canvas receive a region outline. Four pointer paths draw the walls, roof, door and sun.
4. Point to the fixture observation label. Say: "This demo is deterministic. It demonstrates the runtime and input contract without pretending to recognize a real desktop."
5. Wait for **Goal completed**. Expand an `action.executed` event to show the typed command and bridge receipt. Turn on **All transitions** to show the bounded state machine.

## Human approval

1. Return to Demos and choose **Run Claims demo**.
2. Show the entered `CLM-2048` and draft status. Lens pauses before submission.
3. Read the proposed action and policy explanation. Click **Approve action**. The fictional claim becomes submitted and the goal completes.
4. Run the same demo again. When approval appears, press **STOP CONTROL** instead. The approval disappears, the claim remains a draft and the bridge reports stopped. The timeline remains intact.

## Teach and replay

1. Return to Workspace, enable demo control and press **Record Workflow**.
2. Name it `House with a sun`. Run `Open Paint and draw a small house with a sun.`
3. After completion, optionally add a note describing the result. Press **Stop recording**, then **Show workflows**.
4. Press **Run** on the recorded cartridge. The mock app launches a fresh Paint document and replays the same commands and assertions.
5. Press **Edit** to inspect portable JSON. Show that it contains typed steps, assertions and approval requirements. Cancel the editor or save a deliberate edit.
6. Press **Export** to download JSON. The starter claim cartridge demonstrates the `{{claimNumber}}` input and another approval pause.

## Tools and checks

1. Open WebMCP. Show all nineteen tools and the exact schema for `desktop_click`.
2. Use the read-only test for `screen_get_context`. The result contains normalized regions and explicit observation provenance.
3. If native WebMCP is present, ask the browser agent to run the Paint or Notepad goal using those registered tools. It uses the same runtime as the buttons.
4. Open Evals and press **Run evaluations**. Twelve checks should pass, including policy ALLOW/ASK/BLOCK, cancellation, screen-change detection, runtime completion and bridge failure.
5. Reload Workspace. Control is disconnected. Show Settings → Past sessions to read history without resuming input.

## Optional native appendix

Run `pnpm dev:bridge`, share a real screen through the browser dialog and pair using the code in the companion window. Show the distinction between capture permission and input authorization. Explain that live vision is unconfigured; this build supports reviewed low-level input rather than an autonomous real Paint demonstration. Follow the manual checks in `BRIDGE.md` only on a disposable document. Demonstrate Ctrl+Alt+F10.
