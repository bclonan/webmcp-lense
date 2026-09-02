import { ulid } from 'ulid'
import { desktopSummary, regionsFor, type MockDesktop } from '@lens/fixtures'
import type { ScreenObservation } from '@lens/protocol'
import type { VisionProvider } from './VisionProvider'
export class MockVisionProvider implements VisionProvider {
  readonly source = 'fixture' as const
  constructor(private desktop: MockDesktop) {}
  async observe(): Promise<ScreenObservation> {
    return {
      id: ulid(),
      timestamp: Date.now(),
      frameSize: { width: 1001, height: 701 },
      application: this.desktop.app,
      title: this.desktop.app,
      summary: desktopSummary(this.desktop),
      regions: regionsFor(this.desktop),
      source: this.source,
      revision: this.desktop.revision,
    }
  }
}
