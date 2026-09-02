# Desktop protocol v1

Published validators are also available as `packages/schemas/desktop-command.schema.json`, `desktop-result.schema.json` and `capability-cartridge.schema.json`. Regenerate them with `pnpm export:schemas` after changing the Zod definitions.

The browser uses the TypeScript `DesktopBridge` interface. The mock implementation mutates a browser-only desktop. The local implementation sends POST JSON to `http://127.0.0.1:47653`. There is no generic execute-string method.

```ts
interface DesktopBridge {
  connect(): Promise<void>
  disconnect(): Promise<void>
  capabilities(): Promise<BridgeCapabilities>
  execute(command: DesktopCommand): Promise<DesktopResult>
  emergencyStop(): Promise<void>
}
```

## Transport

All requests include the exact allowed Origin, an allowed Host and `Content-Type: application/json`. Authenticated requests also include `Authorization: Bearer <session-token>`. Maximum body size is 16 KiB; chunked or unknown-length request bodies are rejected. Responses are JSON with `Cache-Control: no-store`. No endpoint accepts cookies.

| Endpoint             | Body                          | Result                                                                          |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `POST /pair`         | `{ "code": "one-time-code" }` | `{ "token": "64-hex-characters", "expiresIn": 1800 }`                           |
| `POST /capabilities` | `{}`                          | Platform, physical desktop bounds, scale, command names, emergency-stop support |
| `POST /execute`      | One command below             | DesktopResult                                                                   |
| `POST /stop`         | `{}`                          | `{ "ok": true }`; revokes token and stops in-flight input                       |
| `POST /disconnect`   | `{}`                          | Same fail-closed behavior as stop                                               |

The companion supports CORS OPTIONS for the exact allowed origin, including the private-network preflight header. Browsers may impose their own local-network permission prompt. The app does not bypass it.

## Commands

Every command has a nonempty ASCII `id`, maximum 64 bytes. Native IDs are single-use within the paired session. The browser generates ULIDs. Coordinates are integer physical pixels inside the companion's reported desktop rectangle; they can be negative on a monitor left of or above the primary monitor.

| Type            | Fields beyond `id` and `type`                                                |
| --------------- | ---------------------------------------------------------------------------- |
| `pointer.move`  | `point: { x, y }`                                                            |
| `pointer.click` | `point: { x, y }`, `button: "left"` or `"right"`                             |
| `pointer.drag`  | `points: [{ x, y }, ...]`, 2 to 128 points; `durationMs`, integer 50 to 5000 |
| `keyboard.text` | `text`, 1 to 2000 UTF-16 units, no NUL on Windows                            |
| `keyboard.key`  | `key`, one of the enum values below                                          |
| `scroll`        | `delta`, integer -1200 to 1200; native wheel units, positive upward          |

Supported keys are `WIN`, `ENTER`, `ESC`, `TAB`, `BACKSPACE`, `DELETE`, `CTRL+A`, `CTRL+C`, `CTRL+V`, `CTRL+S`, `ALT+F4`, `LEFT`, `RIGHT`, `UP`, `DOWN`. There is no `WIN+R` or arbitrary combination string.

```json
{
  "id": "01M1TESTCOMMAND",
  "type": "pointer.drag",
  "points": [
    { "x": 120, "y": 220 },
    { "x": 250, "y": 220 }
  ],
  "durationMs": 600
}
```

## Results and errors

```json
{
  "id": "01M1TESTCOMMAND",
  "ok": true,
  "executedAt": 1788372000000
}
```

`executedAt` is epoch milliseconds when the command attempt finishes. `error` is optional and contains a readable failure message when `ok` is false. A receipt is not semantic proof of success. The browser must observe and verify afterward.

Malformed or disallowed requests return a non-2xx status and `{ "error": "message" }`. Native input failures for an admitted command return its receipt with `ok: false`. The browser validates receipt shape and matching command ID. It never retries a command after an uncertain network result.

## Geometry

Capabilities report `platform`, `desktopBounds`, `displayScale`, `commands`, and `emergencyStop`. The Windows backend returns physical virtual-desktop bounds and `displayScale: 1` because it is already DPI aware. That scalar is not a claim that every monitor uses 100% logical scaling. Calibration maps a captured window or monitor into the correct subrectangle. A normalized endpoint of 1 maps to the final in-bounds pixel, not the first pixel beyond the display.
