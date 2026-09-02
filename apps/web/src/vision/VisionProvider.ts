import type { CapturedFrame, ScreenObservation } from '@lens/protocol'
export interface VisionProvider {
  readonly source: ScreenObservation['source']
  observe(frame?: CapturedFrame): Promise<ScreenObservation>
}
// An integration supplies normalized observations. Credentials stay outside bundled code.
export interface RemoteVisionProvider extends VisionProvider {
  readonly source: 'real provider'
  readonly providerName: string
}
