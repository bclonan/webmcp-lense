import type { DesktopBridge, DesktopCommand, DesktopResult } from '@lens/protocol'
import { capabilitiesSchema, commandSchema, resultSchema } from '@lens/schemas'
export class LocalDesktopBridge implements DesktopBridge {
  private token = ''
  private generation = 0
  private readonly url = 'http://127.0.0.1:47653'
  constructor(private pairingCode: string) {}
  private async request(path: string, body: unknown = {}, token = this.token) {
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
    if (!response.ok) throw new Error(value.error ?? `Bridge returned HTTP ${response.status}`)
    return value
  }
  async connect() {
    const generation = ++this.generation
    const response = await this.request('/pair', { code: this.pairingCode })
    this.pairingCode = ''
    if (typeof response.token !== 'string' || !/^[a-f0-9]{64}$/.test(response.token))
      throw new Error('Invalid bridge pairing response.')
    if (generation !== this.generation) {
      await this.request('/disconnect', {}, response.token)
      throw new Error('Pairing cancelled.')
    }
    this.token = response.token
  }
  async capabilities() {
    return capabilitiesSchema.parse(await this.request('/capabilities'))
  }
  async execute(command: DesktopCommand): Promise<DesktopResult> {
    commandSchema.parse(command)
    if (!this.token) throw new Error('Bridge is not paired.')
    const result = resultSchema.parse(await this.request('/execute', command))
    if (result.id !== command.id) throw new Error('Bridge returned an unexpected command receipt.')
    return result
  }
  async disconnect() {
    ++this.generation
    const token = this.token
    this.token = ''
    if (token) await this.request('/disconnect', {}, token)
  }
  async emergencyStop() {
    ++this.generation
    const token = this.token
    this.token = ''
    if (token) await this.request('/stop', {}, token)
  }
}
