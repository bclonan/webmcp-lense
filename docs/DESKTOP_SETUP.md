# Desktop setup

## Browser-only mode

Open [Lens](https://lens-webmcp.netlify.app). Workspace opens by default, with WebMCP status, 19 tools and the event timeline. Paint, Notepad, workflow recording, replay and evaluations run as browser demos. No companion, repository, terminal or API key is required.

## Connect a desktop

Open [Desktop setup](https://lens-webmcp.netlify.app/setup), or click Desktop setup in Workspace. The existing dialog contains the download selector and pairing steps. It detects your likely OS and lets you choose another. On macOS, choose Apple silicon or Intel.

Downloads appear only after release packages have been built and staged with matching SHA-256 checksums. If the dialog says a verified download has not been published, there is no end-user package available for that platform yet. See [release verification](VERIFICATION.md).

1. Download Lens Bridge for your computer. Windows uses a portable EXE. On macOS, open the DMG and drag Lens Bridge to Applications. Linux uses a Debian package for Ubuntu 24.04 or newer with an X11 session.
2. Open Lens Bridge. It opens a visible window; keep it running. The packaged app defaults to `https://lens-webmcp.netlify.app`. Use Change website if you need another exact HTTPS origin or local development origin.
3. On macOS, allow Lens Bridge in System Settings > Privacy & Security > Accessibility. Quit and reopen it after granting permission. Your browser needs Screen Recording permission to share the screen.
4. In the web dialog, click Choose screen. Select one entire monitor in the browser picker, then Share. Keep the target application on that monitor.
5. Click Copy code in Lens Bridge. Paste it into Pairing code in the web dialog and click Pair bridge. The code is single-use and expires in five minutes. New pairing code revokes any earlier session.
6. Choose the monitor you shared, check its bounds and click Confirm shared monitor. Finish setup.

The connection panel reports the device, bridge/protocol versions, advertised commands and round-trip latency. Test connection performs an authenticated capability request without desktop input. Disconnect revokes control. Reconnect opens setup; click New pairing code in the native window first.

Pairing lasts up to 30 minutes and survives navigation within Lens. Reloading the browser requires another screen share and pairing. Screen permission and session tokens are not saved.

## Run and stop actions

Use the action composer or a listed WebMCP tool. Each live action requires its visible approval card. A sequence runs one step at a time, observes the result, and stops on failure. Keyboard actions wait three seconds after approval so you can focus the target app. An explicit rerun starts again at step 1 with fresh IDs and approvals.

Pause control, Disconnect and Clear pairing in the native app all revoke the session. Click New pairing code to resume. STOP CONTROL in the browser and Ctrl+Alt+F10 also stop input. Quit bridge or close its window to shut down the companion.

## Browser access

A normal website cannot generate trusted native operating-system mouse and keyboard events outside the browser sandbox. Lens Bridge provides that native input boundary. Agent reasoning, WebMCP, workflows and observations remain in the web app.

Screen capture uses the browser's permission picker and stays in memory. It is not a native screenshot command. Clipboard access uses visible browser buttons and normal browser permissions. Agents may propose a clipboard write; a person approves the copy. The bridge exposes no clipboard read, arbitrary shell, arbitrary code, file access or cross-browser tab API.

If a browser asks to connect to the local network, permit the connection to the companion. Some browsers or managed devices block HTTPS-to-loopback requests. If that connection is blocked, browser demos remain available. The companion cannot bypass browser or OS security policies.

## Troubleshooting

- Expired or consumed code: click New pairing code in Lens Bridge and use the fresh code once.
- Wrong website: both windows must show the exact same origin, including scheme and port. Change website in the companion revokes the old pairing.
- Port 47653 unavailable: quit the other Lens Bridge instance. Only one instance should listen.
- macOS permission error: grant Accessibility to Lens Bridge itself, then restart it. Screen Recording belongs to the browser.
- Linux permission/display error: use an X11 graphical session with RandR and XTest. Wayland input is not supported.
- Monitor arrangement changed: reconnect or refresh capabilities, choose the shared monitor again, and confirm. Coordinates use physical pixels on Windows/X11 and logical points on macOS.
- Unsigned preview blocked: follow your device's security policy. No publisher signature or Apple notarization is included.

Contributors can expand Contributor setup in the dialog or use the commands in [BRIDGE.md](BRIDGE.md). Normal users do not need them.
