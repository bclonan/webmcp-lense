# Desktop platforms

The same Rust companion, pairing protocol and reviewed browser actions run on Windows, macOS and Linux X11. Build on the computer you want to control. Netlify hosts only the web app.

| Platform | Input and displays | Setup |
| --- | --- | --- |
| Windows 10/11 | SendInput and physical monitor bounds | Rust MSVC and Visual Studio C++ Build Tools |
| macOS | Enigo with Quartz events, Core Graphics display bounds | Rust, Xcode Command Line Tools, Accessibility permission for the terminal or VS Code running the companion |
| Linux X11 | Enigo with XTest, RandR 1.5 monitor bounds | Rust, C linker, libxkbcommon development library, active X11 graphical session |
| Linux Wayland | Not implemented | Log in to an X11 session. The bridge refuses Wayland, including an XWayland fallback. |

Run `pnpm dev:bridge` from the repository root for the local app. The setup modal supplies the exact origin command for hosted Lens. Do not run as root or administrator. The bridge requires registration of Ctrl+Alt+F10 before accepting input. On Mac this is Control+Option+F10; a keyboard configured for media keys may also require Fn. The terminal's `stop` command and the browser's STOP CONTROL button remain available.

## Mac

Install Apple's Command Line Tools with `xcode-select --install`, then install Rust from its official installer. In System Settings > Privacy & Security > Accessibility, allow the terminal application or VS Code that runs the companion. Lens does not grant this permission. Restart that application if macOS requests it. The browser also needs Screen Recording permission to share the display.

Use `CMD+SPACE` for Spotlight, and `CMD+A`, `CMD+C`, `CMD+V`, `CMD+S` or `CMD+W` for Command shortcuts. `CTRL` remains Control. Those are distinct keys. The legacy `WIN` value sends the Meta key, which is Command on Mac and Super on Linux; it does not open Spotlight. CMD shortcuts are rejected on Windows and Linux.

Mac monitor bounds use logical display points. A Retina screen capture can have more pixels than the reported bounds. Lens maps normalized capture coordinates into those bounds. Do not multiply display origins by the Retina scale factor. Confirm the selected monitor in setup, including after any display-layout change.

## Linux

On Debian or Ubuntu, install the build dependencies with `sudo apt-get install build-essential libxkbcommon-dev`. Use the package manager for your distribution elsewhere. This is a manual prerequisite, not a command exposed through WebMCP.

Start the bridge in an ordinary X11 graphical login session. It uses the session's DISPLAY and X authority. XTest supplies input; RandR 1.5 supplies individual monitor rectangles. No global hotkey or input is advertised if the backend cannot start. Wayland needs a future RemoteDesktop and GlobalShortcuts portal integration, with the compositor's visible permission flow. The current bridge does not attempt to bypass that flow.

Scroll deltas use the existing Lens wheel units, +120 for one upward notch. Mac and Linux round to whole notches; nonzero values that would round to zero return an error. Use multiples of 120 for portable workflows.

## Verification

On this Windows machine, Windows tests and build passed. `cargo check --tests` also passed for `aarch64-apple-darwin` and `x86_64-unknown-linux-gnu`. Browser tests cover both capability responses, Mac logical coordinate mapping, and platform-specific key choices. These checks do not prove actual Mac or Linux input.

The GitHub Actions workflow builds and tests on all three operating systems and produces platform binaries when it runs. It has been added locally but has not run remotely. It skips the physical-monitor test on hosted runners because that test requires an interactive Windows desktop.

Before calling a native platform verified, pair from that platform, share one monitor, and approve a click, text entry, shortcut, scroll and drag in a disposable document. Verify Ctrl+Alt+F10 during a drag, denied Accessibility on Mac, stopped sharing, and a changed monitor layout. Check that a denied or failed action never continues the sequence.

Implementation references: [Enigo](https://docs.rs/enigo/0.6.1/enigo/), [global-hotkey platform requirements](https://docs.rs/global-hotkey/0.8.0/global_hotkey/), and [Core Graphics displays](https://docs.rs/core-graphics/0.25.0/core_graphics/display/struct.CGDisplay.html).
