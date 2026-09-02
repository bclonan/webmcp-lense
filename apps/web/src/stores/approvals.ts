import { defineStore } from 'pinia'
import type { PendingApproval } from '@lens/protocol'
export const useApprovalsStore = defineStore('approvals', {
  state: () => ({ pending: null as PendingApproval | null }),
})
