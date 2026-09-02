import { describe, expect, it } from 'vitest'
import { VisualChangeDetector } from '../src/screen/VisualChangeDetector'

const width = 128,
  height = 72
function frame(shade = 24) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels.fill(shade, i, i + 3)
    pixels[i + 3] = 255
  }
  return pixels
}
function rect(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  w: number,
  h: number,
  shade: number,
) {
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++) {
      const offset = (row * width + col) * 4
      pixels.fill(shade, offset, offset + 3)
    }
}

describe('Live visual change detection', () => {
  it('detects a small dark menu that disappears in a whole-screen average', () => {
    const detector = new VisualChangeDetector(),
      before = frame(),
      menu = frame()
    detector.compare(before, width)
    rect(menu, 3, 2, 12, 36, 44)
    expect((12 * 36 * 20) / (width * height * 255)).toBeLessThan(detector.threshold)
    expect(detector.compare(menu, width).changed).toBe(true)
    expect(detector.compare(menu, width).changed).toBe(false)
    expect(detector.compare(before, width).changed).toBe(true)
  })

  it('detects a short line of text in a previously empty editor', () => {
    const detector = new VisualChangeDetector(),
      text = frame()
    detector.compare(frame(), width)
    rect(text, 25, 10, 18, 1, 100)
    expect(detector.compare(text, width).changed).toBe(true)
  })

  it('ignores unchanged frames, faint noise and one bright caret sample', () => {
    const detector = new VisualChangeDetector()
    detector.compare(frame(), width)
    expect(detector.compare(frame(), width).changed).toBe(false)
    expect(detector.compare(frame(25), width).changed).toBe(false)
    const caret = frame()
    rect(caret, 25, 10, 1, 1, 255)
    expect(detector.compare(caret, width).changed).toBe(false)
  })

  it('resets the baseline on capture restart or a dimension change', () => {
    const detector = new VisualChangeDetector()
    detector.compare(frame(), width)
    detector.reset()
    expect(detector.compare(frame(255), width).changed).toBe(false)
    expect(detector.compare(frame(), width / 2).changed).toBe(false)
  })

  it('rejects invalid pixel dimensions', () => {
    const detector = new VisualChangeDetector()
    expect(() => detector.compare(frame(), 0)).toThrow('dimensions')
    expect(() => detector.compare(frame(), 127)).toThrow('dimensions')
  })
})
