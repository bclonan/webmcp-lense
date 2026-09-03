# Platforms

| Platform | Native backend | Package | Required environment |
| --- | --- | --- | --- |
| Windows x64 | SendInput, per-monitor DPI awareness and monitor APIs | Portable EXE | Windows 10/11 desktop, ordinary user privileges |
| macOS arm64 and x64 | Enigo Quartz input, Core Graphics monitor bounds | DMG containing Lens Bridge.app | macOS 12+, Accessibility permission for Lens Bridge |
| Linux x64 | Enigo X11/XTest, RandR monitors | DEB with application launcher | Ubuntu 24.04+ X11 graphical session |

These are package targets. Consult [VERIFICATION.md](VERIFICATION.md) for actual build, download and launch results. Target support does not mean a downloadable package has already passed native testing.

## macOS

Allow Lens Bridge itself in System Settings > Privacy & Security > Accessibility, then quit and reopen it. The browser needs Screen Recording permission for sharing. The companion never silently grants permissions. Display bounds use logical points; browser capture pixels map to these bounds on Retina displays. CMD shortcuts are explicit, while CTRL shortcuts retain literal Control behavior. The independent stop shortcut is Control+Option+F10; some keyboards also require Fn.

Packages have no publisher signature or Apple notarization. Device security policies may prevent launch. No bypass or permission workaround is included.

## Linux

X11 native input requires XTest and RandR plus libxkbcommon. The DEB declares its shared-library dependencies and installs an application launcher. The package requires Ubuntu 24.04 or a compatible system with glibc 2.39 or newer. Other distributions and ARM Linux are not packaged in this release.

Wayland desktop input is not implemented. The companion detects a Wayland session and displays an error instead of silently using XWayland for input. Browser-only demos remain available.

## Windows

The companion uses physical desktop pixels and enumerates monitors without changing display settings. It does not elevate, accept UAC, or control secure desktops. Higher-integrity apps may reject SendInput. Only ordinary user applications are supported. The portable EXE needs no terminal or Rust installation. Current packages are unsigned previews.

## Contributor prerequisites

Windows needs Rust MSVC and Visual Studio C++ Build Tools. macOS needs Rust and Xcode Command Line Tools. Ubuntu build runners install libxkbcommon-dev, libwayland-dev, libx11-dev, libxi-dev, libxcursor-dev, libxrandr-dev and libgl1-mesa-dev plus a C linker. These are build prerequisites, not instructions for normal demo users.

All backends use one protocol, session implementation, strict payload bounds, duplicate-ID checks and stop epochs. The native GUI remains open while running. Quit stops pending input and shuts down the listener.
