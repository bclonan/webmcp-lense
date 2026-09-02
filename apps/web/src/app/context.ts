import { inject, type InjectionKey } from 'vue'
import type { LensService } from './LensService'
export const lensKey: InjectionKey<LensService> = Symbol('lens')
export function useLens() {
  const service = inject(lensKey)
  if (!service) throw new Error('Lens services are not initialized.')
  return service
}
