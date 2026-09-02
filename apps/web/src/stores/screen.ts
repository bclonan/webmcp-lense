import { defineStore } from 'pinia'
import { freshDesktop } from '@lens/fixtures'
import type { CaptureGeometry, ScreenObservation } from '@lens/protocol'
export const useScreenStore = defineStore('screen', {
  state: () => ({
    desktop: freshDesktop(),
    observation: null as ScreenObservation | null,
    sharing: false,
    regionsVisible: true,
    geometry: {
      captureWidth: 1001,
      captureHeight: 701,
      desktopBounds: { x: 0, y: 0, width: 1001, height: 701 },
      displayScale: 1,
      calibrated: true,
    } as CaptureGeometry,
    changeRevision: 0,
  }),
})
