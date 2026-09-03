import { defineStore } from 'pinia'
import { ulid } from 'ulid'
import type { CapabilityCartridge, RuntimeEvent } from '@lens/protocol'
export const useSessionStore = defineStore('session', {
  state: () => ({
    id: ulid(),
    createdAt: Date.now(),
    resetting: false,
    fresh: false,
    mode: 'demo' as 'demo' | 'live',
    authorized: false,
    events: [] as RuntimeEvent[],
    cartridges: [] as CapabilityCartridge[],
    recording: false,
    persistenceError: '',
    error: '',
    setupOpen: false,
    setupReason: '',
    history: [] as { id: string; createdAt: number; mode: string }[],
  }),
})
