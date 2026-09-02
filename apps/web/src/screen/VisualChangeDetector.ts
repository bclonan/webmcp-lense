export class VisualChangeDetector {
  private baseline?: Uint8ClampedArray
  constructor(public threshold = 0.025) {}
  reset() {
    this.baseline = undefined
  }
  compare(pixels: Uint8ClampedArray): { changed: boolean; difference: number } {
    if (!pixels.length || pixels.length % 4) throw new Error('Expected RGBA pixel data.')
    if (!this.baseline || this.baseline.length !== pixels.length) {
      this.baseline = pixels.slice()
      return { changed: false, difference: 0 }
    }
    let difference = 0
    for (let i = 0; i < pixels.length; i += 4)
      for (let c = 0; c < 3; c++) difference += Math.abs(pixels[i + c] - this.baseline[i + c])
    difference /= (pixels.length / 4) * 3 * 255
    const changed = difference >= this.threshold
    if (changed) this.baseline = pixels.slice()
    return { changed, difference }
  }
}
