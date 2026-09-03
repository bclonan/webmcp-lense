import type {
  BridgeCapabilities,
  DesktopBridge,
  DesktopCommand,
  DesktopResult,
  NormalizedPoint,
} from '@lens/protocol'
import { commandSchema } from '@lens/schemas'
import { regionsFor, type MockDesktop } from '@lens/fixtures'
export class MockDesktopBridge implements DesktopBridge {
  connected = false
  failNext = false
  constructor(readonly desktop: MockDesktop) {}
  async connect() {
    this.connected = true
  }
  async disconnect() {
    this.connected = false
  }
  async emergencyStop() {
    this.connected = false
  }
  async capabilities(): Promise<BridgeCapabilities> {
    return {
      platform: 'mock',
      desktopBounds: { x: 0, y: 0, width: 1001, height: 701 },
      displayScale: 1,
      commands: [
        'pointer.move',
        'pointer.click',
        'pointer.drag',
        'keyboard.text',
        'keyboard.key',
        'scroll',
      ],
      emergencyStop: true,
    }
  }
  async execute(input: DesktopCommand): Promise<DesktopResult> {
    const c = commandSchema.parse(input)
    if (!this.connected || this.failNext) {
      this.failNext = false
      return {
        id: c.id,
        ok: false,
        executedAt: Date.now(),
        error: 'Mock bridge disconnected. Re-enable demo control to retry.',
      }
    }
    if (c.type === 'keyboard.key' && c.key.startsWith('CMD+'))
      return {
        id: c.id,
        ok: false,
        executedAt: Date.now(),
        error: 'CMD shortcuts require a paired Mac. This demo uses Windows shortcuts.',
      }
    const d = this.desktop
    const normalized = (p: NormalizedPoint) => ({ x: p.x / 1000, y: p.y / 700 })
    if (c.type === 'pointer.move') d.pointer = normalized(c.point)
    if (c.type === 'pointer.click') {
      const p = normalized(c.point)
      d.pointer = p
      const hit = regionsFor(d).find(
        (r) =>
          p.x >= r.bounds.x &&
          p.x <= r.bounds.x + r.bounds.width &&
          p.y >= r.bounds.y &&
          p.y <= r.bounds.y + r.bounds.height,
      )
      d.focus = hit?.id ?? ''
      if (hit?.id === 'visual:start') {
        d.searchOpen = true
        d.search = ''
        d.focus = 'visual:search'
      }
      if (hit?.id === 'visual:paint') d.app = 'Paint'
      if (hit?.id === 'visual:notepad') d.app = 'Notepad'
      if (hit?.id === 'visual:claims') d.app = 'Legacy Claims Manager'
      if (hit?.id === 'visual:search-result') this.openSearch()
      if (hit?.id === 'visual:submit-claim' && d.claimNumber) d.submitted = true
    }
    if (c.type === 'keyboard.text') {
      if (d.searchOpen) d.search += c.text
      else if (d.app === 'Notepad' && d.focus === 'visual:editor') d.text += c.text
      else if (d.app === 'Legacy Claims Manager' && d.focus === 'visual:claim-number')
        d.claimNumber += c.text
      else
        return {
          id: c.id,
          ok: false,
          executedAt: Date.now(),
          error: 'No editable field is focused.',
        }
    }
    if (c.type === 'keyboard.key') {
      if (c.key === 'WIN') {
        d.searchOpen = true
        d.search = ''
        d.focus = 'visual:search'
      }
      if (c.key === 'ENTER' && d.searchOpen) this.openSearch()
      if (c.key === 'ESC') d.searchOpen = false
      if (c.key === 'ALT+F4') {
        d.app = 'desktop'
        d.focus = ''
      }
      if (c.key === 'CTRL+A') {
        if (d.searchOpen) d.search = ''
        else if (d.focus === 'visual:editor') d.text = ''
        else if (d.focus === 'visual:claim-number') d.claimNumber = ''
      }
      if (c.key === 'BACKSPACE' || c.key === 'DELETE') {
        if (d.searchOpen) d.search = d.search.slice(0, -1)
        else if (d.focus === 'visual:editor') d.text = d.text.slice(0, -1)
      }
    }
    if (c.type === 'pointer.drag') {
      if (
        d.app !== 'Paint' ||
        c.points.some((p) => p.x < 80 || p.x > 920 || p.y < 175 || p.y > 602)
      )
        return {
          id: c.id,
          ok: false,
          executedAt: Date.now(),
          error: 'Drag must remain inside the Paint canvas.',
        }
      d.strokes.push(c.points.map(normalized))
      d.pointer = normalized(c.points[c.points.length - 1])
    }
    if (c.type === 'scroll') d.scroll += c.delta
    d.revision++
    return { id: c.id, ok: true, executedAt: Date.now() }
  }
  private openSearch() {
    const d = this.desktop,
      query = d.search.toLowerCase()
    if (query.includes('paint')) d.app = 'Paint'
    else if (query.includes('notepad')) d.app = 'Notepad'
    else if (query.includes('claim')) d.app = 'Legacy Claims Manager'
    else throw new Error('No matching application in the demo desktop.')
    d.searchOpen = false
    d.focus = ''
    d.text = ''
    d.strokes = []
    d.claimNumber = ''
    d.submitted = false
  }
}
