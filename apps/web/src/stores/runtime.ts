import { defineStore } from 'pinia'
import type { ActionRequest, Goal, GoalPlan, RuntimeState } from '@lens/protocol'
export const useRuntimeStore = defineStore('runtime', {
  state: () => ({
    state: 'idle' as RuntimeState,
    busy: false,
    goal: null as Goal | null,
    proposed: null as ActionRequest | null,
    policy: '',
    failure: '',
    step: 0,
    total: 0,
    lastRun: null as { text: string; plan?: GoalPlan; mode: 'live' | 'demo' } | null,
  }),
})
