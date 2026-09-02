# Implementation passes

1. Built the workspace, typed protocol, deterministic desktop, mock input, planner, bounded runtime, Pinia state and event timeline. The web build passed.
2. Added browser permission-based capture, sampled local change detection, live preview, normalized geometry and the local bridge adapter. The web build passed.
3. Added the canonical tool registry, strict input/output validation, native WebMCP detection, inspector and registration cleanup. The web build passed.
4. Implemented the Windows companion, pairable loopback transport, validation, native input and emergency-stop hotkey. Rust compilation and protocol/session tests passed.
5. Added recording, annotations, declarative cartridge compilation, variable substitution, replay, editing, export and IndexedDB history. Complete unit and browser flows passed before final documentation and hardening checks.

The final verification record is in `VERIFICATION.md`. No deployment, external model or operating-system permission bypass is part of these passes.
