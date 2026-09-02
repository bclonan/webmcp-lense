import { defineStore } from 'pinia'
export const useSettingsStore = defineStore('settings', {
  state: () => ({ changeThreshold: 0.025, stepDelay: 450, sampleInterval: 500 }),
})
