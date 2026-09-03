# Desktop bridge

The Rust companion owns authorized input and no application intelligence. Windows uses `windows-sys`. Mac and Linux X11 use Enigo for input and global-hotkey for the independent stop shortcut. Core Graphics supplies Mac display bounds; x11rb supplies Linux monitor bounds. The input backend is a Rust trait, independent of transport handling. See [platform setup and verification](PLATFORMS.md) for Mac and Linux requirements and the current Wayland limit.

## Run

Run `pnpm dev:bridge` in a visible terminal after installing your platform's prerequisites. On Windows, use Windows 10 or 11, stable Rust with the MSVC toolchain, and Visual Studio C++ Build Tools. The app's default origin is `http://127.0.0.1:5176`; the bridge binds `127.0.0.1:47653` regardless of origin.

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
| `EnumDisplayMonitors`, `GetMonitorInfoW` | Individual physical monitor bounds for the setup selector |
| `OpenInputDesktop`, `GetUserObjectInformationW`, `CloseDesktop` | Reject input when the active desktop is not `Default` or cannot be inspected       |
| `RegisterHotKey`, `GetMessageW`, `UnregisterHotKey`             | Independent Ctrl+Alt+F10 emergency-stop loop                                       |
| OS randomness through `getrandom`                               | Pairing code and session-token generation                                          |

Absolute mouse input uses `MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK`. Drag samples interpolate the requested path and check cancellation about every 10 milliseconds. Text uses Unicode keydown/keyup pairs. Combo keys release in reverse order. The process never changes integrity level or launches another process.

Microsoft documents [SendInput and UIPI limits](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [DPI awareness](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setprocessdpiawarenesscontext), and [RegisterHotKey](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey).

## Manual Paint and Notepad check

This check is interactive. Automated tests compile the Windows backend and test transport with a substitute input backend; they do not type into your real applications.

1. Open a disposable Notepad document or blank Paint canvas yourself. Keep Lens visible alongside it if possible.
2. In Lens, press Desktop setup, then Choose screen. Select one monitor in the browser prompt. No permissions are pre-granted.
3. Pair with the code printed by the companion and select the shared monitor. Confirm it and finish setup. For a window capture, expand custom bounds and enter the captured content rectangle, which may exclude window borders.
4. Select Click a point in the action composer. Use horizontal 50% and vertical 50% only if the center of your shared capture is inside the intended editing area. Review and approve the action.
5. For Notepad, select Type text and enter `The house is finished.`. After approval, focus Notepad during the three-second pause. Confirm the resulting text yourself. The live detector only verifies that pixels changed.
6. For Paint, use Drag a path wholly inside the visible canvas. Map each point to 0..1 relative to the full capture. Approve and inspect each stroke. The fixture's house coordinates are not valid for an arbitrary real Paint layout.
7. To attempt launching through Start, propose `desktop_press` with `WIN`, then type `Paint` or `Notepad`, then press `ENTER`, one reviewed action at a time. During each keyboard pause, focus the appropriate desktop or search field. Lens does not select the foreground window automatically.
8. Press Ctrl+Alt+F10 and attempt another action. Input should be rejected. Type `enable` in the bridge console and pair again to resume.
9. Navigate to Settings and back. Sharing and pairing remain active. Stop sharing to release all capture tracks and disable input. Reloading never re-pairs or restarts a goal.

Use a stable capture layout. Recalibrate if a window moves, resizes or switches monitors. A missed visual change stops the sequence after four seconds but preserves pairing. Inspect the screen before deciding whether to rerun; an action may have executed even if verification failed. Copy and pointer movement use a bridge receipt because they do not require a visible change. That receipt does not assert clipboard contents or semantic success. Each new step and rerun uses the same policy and approval checks.

## Known limits

The bridge does not know window identities, application state or semantic targets. It does not read the filesystem or screenshot the desktop. Real recognition and multimodal planning require a future browser-side adapter. Keyboard focus is manual. Windows may reject input into elevated applications. Secure desktop interaction is deliberately unsupported. Hosted HTTPS pages may face mixed-content or local-network restrictions; use the localhost app for the supported native workflow.
