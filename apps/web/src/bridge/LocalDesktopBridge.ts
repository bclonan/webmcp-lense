import type {
  DesktopBridge,
  DesktopCommand,
  DesktopResult,
  BridgeCapabilities,
} from '@lens/protocol'
import {
  nativeCapabilitiesSchema,
  commandSchema,
  pairedResponseSchema,
  bridgeRequestSchema,
  bridgeReceiptSchema,
} from '@lens/schemas'
export class LocalDesktopBridge implements DesktopBridge {
  private token = ''
  private sessionId = ''
  private manifest: BridgeCapabilities | null = null
  private generation = 0
  expiresAt = 0
  latencyMs = 0
  private readonly url = 'http://127.0.0.1:47653'
  constructor(private pairingCode: string) {}
  private sessionBody() {
    return { protocolVersion: 1, sessionId: this.sessionId, timestamp: Date.now() }
  }
  private async request(path: string, body: unknown = this.sessionBody(), token = this.token) {
    const start = performance.now()
    const response = await fetch(this.url + path, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    const value = await response.json()
    this.latencyMs = Math.round(performance.now() - start)
    if (!response.ok)
      throw new Error(
        typeof value.error === 'string'
          ? value.error
          : `${value.error?.code ?? 'connection_failed'}: ${value.error?.message ?? `Bridge returned HTTP ${response.status}`}`,
      )
    return value
  }
  async connect() {
    const generation = ++this.generation
    const raw = await this.request('/pair', { protocolVersion: 1, code: this.pairingCode })
    this.pairingCode = ''
    const parsed = pairedResponseSchema.safeParse(raw)
    if (!parsed.success)
      throw new Error(
        'Companion protocol mismatch. Download the current Lens Bridge and pair again.',
      )
    const response = parsed.data
    if (generation !== this.generation) {
      await this.request(
        '/disconnect',
        { protocolVersion: 1, sessionId: response.sessionId, timestamp: Date.now() },
        response.token,
      )
      throw new Error('Pairing cancelled.')
    }
    this.token = response.token
    this.sessionId = response.sessionId
    this.expiresAt = Date.now() + response.expiresIn * 1000
  }
  async capabilities() {
    const capabilities = nativeCapabilitiesSchema.parse(await this.request('/capabilities'))
    if (capabilities.sessionId !== this.sessionId)
      throw new Error('Companion session changed. Reconnect.')
    this.manifest = capabilities
    return capabilities
  }
  async execute(command: DesktopCommand): Promise<DesktopResult> {
    commandSchema.parse(command)
    if (!this.token || !this.manifest)
      throw new Error('Bridge is not paired. Connect and test capabilities first.')
    if (
      !this.manifest.commands.includes(command.type) ||
      (command.type === 'keyboard.key' && !this.manifest.keys?.includes(command.key))
    )
      throw new Error('This companion does not support the requested action.')
    const message = bridgeRequestSchema.parse({
      ...this.sessionBody(),
      displayRevision: this.manifest.displayRevision,
      command,
    })
    const receipt = bridgeReceiptSchema.parse(await this.request('/execute', message))
    if (
      receipt.sessionId !== this.sessionId ||
      receipt.commandId !== command.id ||
      receipt.result.id !== command.id ||
      (receipt.status === 'completed') !== receipt.result.ok
    )
      throw new Error('Bridge returned an unexpected command receipt.')
    return receipt.result
  }
  async disconnect() {
    ++this.generation
    const token = this.token
    this.token = ''
    this.manifest = null
    if (token) await this.request('/disconnect', this.sessionBody(), token)
  }
  async emergencyStop() {
    ++this.generation
    const token = this.token
    this.token = ''
    this.manifest = null
    if (token) await this.request('/stop', this.sessionBody(), token)
  }
}
