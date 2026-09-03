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
import { BridgeError, responseError } from './errors'
export class LocalDesktopBridge implements DesktopBridge {
  private token = ''
  private sessionId = ''
  private manifest: BridgeCapabilities | null = null
  private generation = 0
  private capabilityRequest: Promise<BridgeCapabilities> | null = null
  expiresAt = 0
  latencyMs = 0
  private readonly url = 'http://127.0.0.1:47653'
  constructor(private pairingCode: string) {}
  private sessionBody() {
    return { protocolVersion: 1, sessionId: this.sessionId, timestamp: Date.now() }
  }
  private async request(
    path: string,
    body: unknown = this.sessionBody(),
    token = this.token,
    readGeneration?: number,
  ) {
    // Only authenticated read requests may retry. Pairing and input are single-attempt.
    for (let attempt = 0; ; attempt++) {
      if (readGeneration !== undefined && readGeneration !== this.generation)
        throw new BridgeError('cancelled', 'Connection check cancelled.')
      const start = performance.now()
      try {
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
        let value: unknown
        try {
          value = await response.json()
        } catch (error) {
          if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
            throw error
          if (!response.ok) throw responseError(null, response.status)
          throw new BridgeError(
            'invalid_response',
            'The companion returned an unreadable response. Restart Lens Bridge and reload this page.',
          )
        }
        this.latencyMs = Math.round(performance.now() - start)
        if (!response.ok) throw responseError(value, response.status)
        return value
      } catch (error) {
        const timeout =
          error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        const failure =
          error instanceof BridgeError
            ? error
            : new BridgeError(
                timeout ? 'connection_timeout' : 'connection_unavailable',
                timeout
                  ? 'Lens Bridge took too long to respond.'
                  : "Could not reach Lens Bridge. Keep it open, check that Allowed website matches this page, and allow the browser's local-network prompt if shown.",
                true,
              )
        if (
          readGeneration !== undefined &&
          attempt === 0 &&
          failure.retryable &&
          readGeneration === this.generation
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          continue
        }
        if (path === '/pair' && failure.retryable)
          throw new BridgeError(
            failure.code,
            `${failure.message} Pairing was not confirmed. The code may have been used; click New pairing code in Lens Bridge before trying again.`,
          )
        if (path === '/execute' && failure.retryable)
          throw new BridgeError(
            'execution_uncertain',
            `${failure.message} The action may already have happened. Check the target app before proposing another action.`,
          )
        throw failure
      }
    }
  }
  async connect() {
    const generation = ++this.generation
    const raw = await this.request('/pair', { protocolVersion: 1, code: this.pairingCode })
    this.pairingCode = ''
    const parsed = pairedResponseSchema.safeParse(raw)
    if (!parsed.success)
      throw new BridgeError(
        'protocol_mismatch',
        'Companion protocol mismatch. Reload this page and use the current Lens Bridge, then pair again.',
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
  capabilities(): Promise<BridgeCapabilities> {
    if (this.capabilityRequest) return this.capabilityRequest
    const task = this.readCapabilities()
    this.capabilityRequest = task
    void task
      .finally(() => {
        if (this.capabilityRequest === task) this.capabilityRequest = null
      })
      .catch(() => {})
    return task
  }
  private async readCapabilities() {
    const generation = this.generation
    const raw = await this.request('/capabilities', this.sessionBody(), this.token, generation)
    if (generation !== this.generation || !this.token)
      throw new BridgeError('cancelled', 'Connection check cancelled.')
    const parsed = nativeCapabilitiesSchema.safeParse(raw)
    if (!parsed.success)
      throw new BridgeError(
        'invalid_response',
        'Lens Bridge returned incompatible capabilities. Reload this page and restart the current companion.',
      )
    const capabilities = parsed.data
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
