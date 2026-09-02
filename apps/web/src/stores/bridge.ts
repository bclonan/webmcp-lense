import { defineStore } from 'pinia'
import type { BridgeCapabilities } from '@lens/protocol'
export const useBridgeStore = defineStore('bridge', {
  state: () => ({
    status: 'disconnected' as 'disconnected' | 'connected' | 'stopped' | 'connecting',
    capabilities: null as BridgeCapabilities | null,
    error: '',
  }),
})
