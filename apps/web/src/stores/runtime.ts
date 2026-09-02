import { defineStore } from 'pinia'
import type { ActionRequest, Goal, RuntimeState } from '@lens/protocol'
export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    state: 'idle' as RuntimeState,
    busy: false,
    goal: null as Goal | null,
    proposed: null as ActionRequest | null,
    policy: '',
  }),
})
