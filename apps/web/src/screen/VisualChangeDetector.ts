export class VisualChangeDetector {
  private baseline?: Uint8ClampedArray
  private baselineWidth = 0
  constructor(public threshold = 0.025) {}
  reset() {
    this.baseline = undefined
    this.baselineWidth = 0
  }
  compare(
    pixels: Uint8ClampedArray,
    width = pixels.length / 4,
  ): { changed: boolean; difference: number } {
    if (!pixels.length || pixels.length % 4) throw new Error('Expected RGBA pixel data.')
    const height = pixels.length / 4 / width
    if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height))
      throw new Error('Pixel dimensions must match the RGBA data.')
    if (!this.baseline || this.baseline.length !== pixels.length || this.baselineWidth !== width) {
      this.baseline = pixels.slice()
      this.baselineWidth = width
      return { changed: false, difference: 0 }
    }
    // A menu or line of text can change without moving the whole-frame average.
    // Average within tiles so one noisy pixel or blinking caret is still ignored.
    let difference = 0
    for (let top = 0; top < height; top += 8) {
      for (let left = 0; left < width; left += 8) {
        const bottom = Math.min(top + 8, height),
          right = Math.min(left + 8, width)
        let sum = 0
        for (let y = top; y < bottom; y++)
          for (let x = left; x < right; x++) {
            const i = (y * width + x) * 4
            for (let c = 0; c < 3; c++) sum += Math.abs(pixels[i + c] - this.baseline[i + c])
          }
        difference = Math.max(difference, sum / ((bottom - top) * (right - left) * 3 * 255))
      }
    }
    const changed = difference >= this.threshold
    if (changed) this.baseline = pixels.slice()
    return { changed, difference }
  }
}
