# Desktop setup and browser access

Open Workspace and click **Desktop setup**. The modal has three steps.

1. **Share a screen.** Click Choose screen, select one monitor in the browser prompt, and click Share. Put the target app on that monitor. Keep Lens on another monitor if possible.
2. **Pair the bridge.** In the Lens project terminal, run the command shown in the modal. It uses `pnpm dev:bridge` for the default local page and sets the exact allowed origin for other addresses, including Netlify. Leave it running. Paste the value printed after `Pairing code:` into the modal and click Pair bridge. If a previous code was consumed or control stopped, type `enable` in the companion terminal for a fresh code.
3. **Choose the monitor.** Select the monitor you shared from the companion's display list and confirm it. Lens remembers bounds as a suggestion. A saved rectangle never grants control or skips confirmation. Window captures need their bounds in the companion's coordinate space. On Mac those are logical points; on Windows and Linux X11 they are physical pixels.

The pairing step has Windows, Mac and Linux instructions. See [platform requirements](PLATFORMS.md). Mac requires Accessibility permission for the app running the companion. Linux support currently requires X11.

After setup, choose an action. Click **Add step** to build up to 20 steps, then review them in order. Every action observes the screen again, uses the same policy, and asks for approval when needed. Keyboard input waits three seconds after approval so you can focus the intended app. No semantic vision provider is configured, so live coordinates and outcomes still need your review.

One possible sequence is pressing WIN, typing Notepad, pressing ENTER, then typing a short note. Each keyboard step has its own review. With an already open blank document, a single Type text action is a simpler first check.

## Staying connected and rerunning

Pairing stays active between actions, after ordinary action failures, and across Lens pages. Navigating away from Workspace cancels any unfinished sequence. A visible banner reports continued screen sharing. A periodic read-only bridge check detects connection loss, expiry, and display-layout changes while idle.

A failure or denial stops all remaining steps. Lens does not retry or skip the failed step. Check the actual screen first because the input may already have happened. **Run again** offers **Rerun from first step**, which creates fresh command IDs and repeats the approval checks. This can duplicate text or other effects. Recorded workflows also replay through this runtime.

STOP CONTROL, Ctrl+Alt+F10, loss of capture, a bridge failure, or session expiry requires pairing again. Cancelling during native execution stops the bridge. Pairing lasts 30 minutes and is kept only in memory. A page reload ends it. Browsers require a new user choice for screen capture and do not allow that permission to be saved. See [MDN's screen-sharing restrictions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia#security).

## Clipboard and other browser capabilities

Expand **Clipboard and browser access** in Workspace. **Read clipboard text** loads up to 2,000 characters into a local review field. You can edit that text, copy it, or request an ordinary reviewed typing action. If reading is unavailable or permission is denied, paste into the field yourself. Clipboard text does not enter an agent result or event log until you choose to type it as an action.

The `browser_clipboard_propose_write` tool creates a visible proposal. **Copy approved text** performs the write from a user click. Browser permissions still apply. Lens reports API availability through `browser_get_capabilities` without reading clipboard contents. See [MDN's Clipboard API permission model](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API#security_considerations).

| Capability | Current support |
| --- | --- |
| Ordered desktop steps and explicit rerun | UI, `desktop_run_sequence`, and `goal_rerun` |
| Screen sharing | Browser chooser opened by the user |
| Clipboard text | User read/copy controls and agent write proposals |
| Current Lens page's WebMCP tools | Native registration when supported, local inspector otherwise |
| Visible Chrome, Edge, VS Code or other Windows apps | Reviewed pointer and keyboard input through the bridge |
| Listing tabs, reading other pages, or calling their tools directly | Not implemented in Lens; requires a browser extension or a separate authorized browser connection |
| Arbitrary system commands, application launching API, unrestricted filesystem | Not exposed by the bridge |

A normal page cannot use extension-only tab APIs. Installing an extension and granting its host permissions is a separate integration, not something pairing the Windows bridge grants. See [Chrome's tab API](https://developer.chrome.com/docs/extensions/reference/api/tabs) and [extension permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
