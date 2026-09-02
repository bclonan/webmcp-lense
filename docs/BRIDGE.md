# Windows bridge

The Rust companion owns authorized input and no application intelligence. Direct dependencies are `serde`, `serde_json`, `tiny_http`, `getrandom` and Windows-only `windows-sys`. The input backend is a Rust trait, independent of transport handling. The browser's `DesktopBridge` interface also permits a future transport replacement.

## Run

Use Windows 10 or 11, stable Rust with the MSVC toolchain, and Visual Studio C++ Build Tools. Run `pnpm dev:bridge` in a visible terminal. The app's default origin is `http://127.0.0.1:5176`; the bridge binds `127.0.0.1:47653` regardless of origin.

For another origin:

```sh
cargo run --manifest-path apps/bridge/Cargo.toml -- --origin http://localhost:5176
```

Open Lens at that exact origin. A scheme, hostname or port mismatch is rejected. Keep the console open. `stop` disables input, `enable` rotates the pairing code and permits a new pairing, and `quit` exits. Closing console stdin also disables input. There is no autostart service.

## Platform APIs

| API                                                             | Use                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SendInput`                                                     | Mouse movement, left/right button events, wheel events, key events and UTF-16 text |
| `SetProcessDpiAwarenessContext`                                 | Request per-monitor DPI awareness v2                                               |
| `GetSystemMetrics`                                              | Physical virtual-desktop origin and dimensions                                     |
| `OpenInputDesktop`, `GetUserObjectInformationW`, `CloseDesktop` | Reject input when the active desktop is not `Default` or cannot be inspected       |
| `RegisterHotKey`, `GetMessageW`, `UnregisterHotKey`             | Independent Ctrl+Alt+F10 emergency-stop loop                                       |
| OS randomness through `getrandom`                               | Pairing code and session-token generation                                          |

Absolute mouse input uses `MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK`. Drag samples interpolate the requested path and check cancellation about every 10 milliseconds. Text uses Unicode keydown/keyup pairs. Combo keys release in reverse order. The process never changes integrity level or launches another process.

Microsoft documents [SendInput and UIPI limits](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [DPI awareness](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setprocessdpiawarenesscontext), and [RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey).

## Manual Paint and Notepad check

This check is interactive. Automated tests compile the Windows backend and test transport with a substitute input backend; they do not type into your real applications.

1. Open a disposable Notepad document or blank Paint canvas yourself. Keep Lens visible alongside it if possible.
2. In Lens, press Share Screen and choose the monitor or window in the browser dialog. No permissions are pre-granted.
3. Pair with the code printed by the companion. Confirm the physical bounds represented by the captured image. For a single full-monitor capture, use that monitor's physical origin, width and height. For a window, enter the captured content rectangle, which may exclude window borders.
4. Select `desktop_click` in the reviewed action composer. Enter `{ "point": { "x": 0.5, "y": 0.5 } }` only if the center of your shared capture is inside the intended editing area. Propose, inspect, and approve it. The selected desktop area receives a click.
5. For Notepad, select `desktop_type` and enter `{ "text": "The house is finished." }`. After approval, focus Notepad during the three-second pause. Confirm the resulting text yourself. The live detector only verifies that pixels changed.
6. For Paint, use `desktop_drag` with a short path wholly inside the visible canvas. Map each point to 0..1 relative to the full capture. Approve and inspect each stroke. The fixture's house coordinates are not valid for an arbitrary real Paint layout.
7. To attempt launching through Start, propose `desktop_press` with `WIN`, then type `Paint` or `Notepad`, then press `ENTER`, one reviewed action at a time. During each keyboard pause, focus the appropriate desktop or search field. Lens does not select the foreground window automatically.
8. Press Ctrl+Alt+F10 and attempt another action. Input should be rejected. Type `enable` in the bridge console and pair again to resume.
9. Stop sharing or leave Workspace. All capture tracks stop and Lens disables control. Reloading never re-pairs or restarts a goal.

Use a stable capture layout. Recalibrate if a window moves, resizes or switches monitors. If an action does not cause a sufficiently large pixel change within four seconds, the runtime fails and disables live actuation. Lower the threshold in Settings if appropriate, then pair again. Never infer success from a command receipt alone.

## Known limits

The bridge does not know window identities, application state or semantic targets. It does not read the filesystem or screenshot the desktop. Real recognition and multimodal planning require a future browser-side adapter. Keyboard focus is manual. Windows may reject input into elevated applications. Secure desktop interaction is deliberately unsupported. Hosted HTTPS pages may face mixed-content or local-network restrictions; use the localhost app for the supported native workflow.
