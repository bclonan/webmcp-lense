# Desktop protocol 1

Lens Bridge 0.2.0 speaks explicit wire protocol 1. The protocol version is independent of the app version. A mismatched version fails before input. The prior unversioned 0.1.0 bridge is incompatible and must be updated.

## Canonical schemas

`packages/schemas/src/index.ts` defines the strict Zod command, request, receipt and capability validators used by the web adapter. `packages/protocol/src/index.ts` defines the domain types. Matching Rust Serde types live in `apps/bridge/src/protocol.rs` and transport envelopes in `src/server.rs`. Run `pnpm export:schemas` to regenerate portable JSON schemas. `bridge-request.schema.json` references the existing bounded command shape inline; it does not introduce another command vocabulary.

## Pair and negotiate

All endpoints accept POST JSON on loopback port 47653 with an exact allowed Origin and Host. Pair first:

```json
{"protocolVersion":1,"code":"single-use code from the native window"}
```

`POST /pair` returns `protocolVersion`, `bridgeVersion`, `sessionId`, Unix-millisecond `timestamp`, `token` and `expiresIn`. The code contains 128 random bits, expires in five minutes and is consumed once. The 256-bit bearer token authorizes a maximum 30-minute session. There are at most five pairing attempts per 30-second window.

Subsequent requests require `Authorization: Bearer <token>`. `POST /capabilities`, `/disconnect` and `/stop` accept only:

```json
{"protocolVersion":1,"sessionId":"32 lowercase hex characters","timestamp":1788364800000}
```

Use the actual current timestamp. Requests more than 30 seconds from the system clock are rejected. Capability results include the bridge/protocol versions, session ID, timestamp, platform, device, coordinate space, desktop bounds, monitor list, display scale, display revision, supported commands, supported key names and emergency-stop availability. The opaque display revision represents the current monitor layout.

## Execute and receive

`POST /execute` wraps the existing bounded command:

```json
{
  "protocolVersion":1,
  "sessionId":"32 lowercase hex characters",
  "timestamp":1788364800000,
  "displayRevision":"opaque value from capabilities",
  "command":{"id":"move-1","type":"pointer.move","point":{"x":842,"y":514}}
}
```

Coordinates are native display coordinates, not CSS pixels. `apps/web/src/screen/coordinates.ts` maps normalized positions in a confirmed capture to physical pixels on Windows/X11 or logical points on macOS. Negative monitor origins and Retina capture scaling remain explicit. The bridge checks coordinates and rejects a changed display revision. A new capability result invalidates a changed browser mapping, which requires visible reconfirmation.

Successful execution returns:

```json
{
  "protocolVersion":1,"bridgeVersion":"0.2.0",
  "sessionId":"32 lowercase hex characters","commandId":"move-1",
  "timestamp":1788364800100,"status":"completed",
  "result":{"id":"move-1","ok":true,"executedAt":1788364800100}
}
```

A native execution failure returns status `failed`, `result.ok: false`, `result.error`, and an `error` object with a stable code and message. Rejected requests return a non-2xx response with protocol/bridge versions, timestamp and `error: {code,message}`. Error codes include `protocol_mismatch`, `invalid_request`, `invalid_command`, `invalid_coordinates`, `unsupported_action`, `session_not_paired`, `session_expired`, `pairing_rejected`, `stale_command`, `screen_changed`, `control_paused`, `duplicate_command`, `busy`, `origin_denied`, `permission_denied` and `execution_failed`.

Only one command executes at a time. Concurrent mutations are rejected, never queued. IDs may execute only once per session, with a maximum of 10,000 IDs. An explicit rerun creates new IDs and returns through the browser's approval flow. The native action receipt confirms attempted input delivery; it does not prove the target application's intended result.

## Commands

| Type | Payload limits |
| --- | --- |
| `pointer.move` | One integer native point inside desktop bounds |
| `pointer.click` | One native point; left or right button |
| `pointer.drag` | 2 to 128 native points; 50 to 5,000 ms |
| `keyboard.text` | 1 to 2,000 UTF-16 units; no NUL |
| `keyboard.key` | One enumerated key or shortcut supported by the platform |
| `scroll` | Integer delta from -1,200 to 1,200 |

Keys shared by the backends are WIN, ENTER, ESC, TAB, BACKSPACE, DELETE, CTRL+A/C/V/S, ALT+F4, LEFT, RIGHT, UP and DOWN. macOS also advertises CMD+A/C/V/S/W and CMD+SPACE. The bridge and web adapter reject unadvertised keys. Command IDs are bounded to 64 ASCII characters. Unknown fields fail validation.

There is no arbitrary shell, URL execution, native code, clipboard, window enumeration or screenshot command. Browser screen sharing supplies observations and the application owns the observe, approve, execute, observe, verify loop. Native input never implies semantic success.
