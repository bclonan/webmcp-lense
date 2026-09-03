Lens Bridge 0.2.0 is an unsigned preview. The existing Rust bridge now opens as a desktop application with a visible five-minute pairing code, connection state, emergency stop and a local action log. Wire protocol 1 adds session and command IDs, structured receipts, capability negotiation and display-layout validation.

Windows x64, macOS Apple silicon and Intel, and Ubuntu 24.04+ X11 packages are built independently. macOS builds are not signed or notarized. Wayland native input is unavailable. Screen observation remains in the browser and requires screen-sharing permission. Native input on macOS requires Accessibility permission for Lens Bridge.

Packages include per-platform SHA-256 manifests. This repository is private; the public Lens site distributes checksum-verified copies of these release packages.
