import type {
  CaptureGeometry,
  DesktopPoint,
  NormalizedPoint,
  ScreenObservation,
} from '@lens/protocol'
export function validPoint(point: NormalizedPoint): NormalizedPoint {
  if (![point.x, point.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
    throw new Error('Point must be in normalized 0..1 coordinates.')
  return point
}
export function captureToNormalized(
  point: DesktopPoint,
  geometry: CaptureGeometry,
): NormalizedPoint {
  if (geometry.captureWidth <= 0 || geometry.captureHeight <= 0)
    throw new Error('Capture has no dimensions.')
  return validPoint({ x: point.x / geometry.captureWidth, y: point.y / geometry.captureHeight })
}
export function normalizedToDesktop(
  point: NormalizedPoint,
  geometry: CaptureGeometry,
): DesktopPoint {
  validPoint(point)
  if (!geometry.calibrated)
    throw new Error('Confirm the capture-to-desktop mapping before control.')
  const b = geometry.desktopBounds
  if (b.width <= 0 || b.height <= 0) throw new Error('Invalid desktop bounds.')
  return {
    x: Math.round(b.x + point.x * (b.width - 1)),
    y: Math.round(b.y + point.y * (b.height - 1)),
  }
}
export function desktopToNormalized(
  point: DesktopPoint,
  geometry: CaptureGeometry,
): NormalizedPoint {
  const b = geometry.desktopBounds
  return validPoint({ x: (point.x - b.x) / (b.width - 1), y: (point.y - b.y) / (b.height - 1) })
}
export function normalizedToCapture(
  point: NormalizedPoint,
  geometry: CaptureGeometry,
): DesktopPoint {
  validPoint(point)
  if (geometry.captureWidth <= 0 || geometry.captureHeight <= 0)
    throw new Error('Capture has no dimensions.')
  return { x: point.x * geometry.captureWidth, y: point.y * geometry.captureHeight }
}
export function resolveTarget(id: string, observation: ScreenObservation): NormalizedPoint {
  const region = observation.regions.find((r) => r.id === id)
  if (!region) throw new Error(`Target ${id} is not in the current observation.`)
  if (region.confidence < 0.7) throw new Error('Target confidence is too low. Observe again.')
  return validPoint({
    x: region.bounds.x + region.bounds.width / 2,
    y: region.bounds.y + region.bounds.height / 2,
  })
}
