import { openDB, type IDBPDatabase } from 'idb'
import type { CapabilityCartridge, RuntimeEvent } from '@lens/protocol'
export class Repository {
  private db?: Promise<IDBPDatabase>
  private database() {
    return (this.db ??= openDB('lens-local', 1, {
      upgrade(db) {
        db.createObjectStore('settings')
        db.createObjectStore('sessions', { keyPath: 'id' })
        db.createObjectStore('events', { keyPath: 'id' }).createIndex('sessionId', 'sessionId')
        db.createObjectStore('cartridges', { keyPath: 'id' })
      },
    }))
  }
  async append(event: RuntimeEvent) {
    await (await this.database()).add('events', JSON.parse(JSON.stringify(event)))
  }
  async saveSession(session: { id: string; createdAt: number; mode: string }) {
    await (await this.database()).put('sessions', session)
  }
  async sessions() {
    return (await this.database()).getAll('sessions')
  }
  async events(sessionId: string): Promise<RuntimeEvent[]> {
    return (await this.database()).getAllFromIndex('events', 'sessionId', sessionId)
  }
  async settings(): Promise<Record<string, number> | undefined> {
    return (await this.database()).get('settings', 'preferences')
  }
  async saveSettings(value: Record<string, number>) {
    await (await this.database()).put('settings', value, 'preferences')
  }
  async cartridges(): Promise<CapabilityCartridge[]> {
    return (await this.database()).getAll('cartridges')
  }
  async saveCartridge(value: CapabilityCartridge) {
    await (await this.database()).put('cartridges', JSON.parse(JSON.stringify(value)))
  }
}
