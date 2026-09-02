import type { NormalizedPoint, VisualRegion } from '@lens/protocol'
export type DemoApp = 'desktop' | 'Paint' | 'Notepad' | 'Legacy Claims Manager'
export interface MockDesktop {
  app: DemoApp
  searchOpen: boolean
  search: string
  text: string
  strokes: NormalizedPoint[][]
  claimNumber: string
  submitted: boolean
  focus: string
  revision: number
  pointer: NormalizedPoint
  scroll: number
}
export const freshDesktop = (): MockDesktop => ({
  app: 'desktop',
  searchOpen: false,
  search: '',
  text: '',
  strokes: [],
  claimNumber: '',
  submitted: false,
  focus: '',
  revision: 0,
  pointer: { x: 0.5, y: 0.5 },
  scroll: 0,
})
const region = (
  id: string,
  role: VisualRegion['role'],
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  text = '',
  consequential = false,
): VisualRegion => ({
  id: `visual:${id}`,
  role,
  label,
  text,
  bounds: { x, y, width, height },
  confidence: 1,
  consequential,
})
export function regionsFor(d: MockDesktop): VisualRegion[] {
  const common = [region('start', 'button', 'Start', 0.02, 0.92, 0.07, 0.07)]
  if (d.searchOpen)
    return [
      ...common,
      region('search', 'input', 'Search applications', 0.2, 0.36, 0.6, 0.1, d.search),
      region(
        'search-result',
        'button',
        d.search || 'Type an application name',
        0.2,
        0.5,
        0.6,
        0.14,
      ),
    ]
  if (d.app === 'Paint')
    return [
      ...common,
      region('canvas', 'canvas', 'Drawing canvas', 0.08, 0.25, 0.84, 0.61),
      region('save', 'button', 'Save drawing', 0.81, 0.12, 0.1, 0.06, '', true),
    ]
  if (d.app === 'Notepad')
    return [
      ...common,
      region('editor', 'input', 'Document text', 0.08, 0.25, 0.84, 0.61, d.text),
      region('save', 'button', 'Save document', 0.81, 0.12, 0.1, 0.06, '', true),
    ]
  if (d.app === 'Legacy Claims Manager')
    return [
      ...common,
      region('claim-number', 'input', 'Claim number', 0.15, 0.34, 0.45, 0.09, d.claimNumber),
      region('submit-claim', 'button', 'Submit claim', 0.65, 0.64, 0.2, 0.1, '', true),
      region(
        'claim-status',
        'text',
        'Claim status',
        0.15,
        0.5,
        0.65,
        0.07,
        d.submitted ? 'Claim submitted' : 'Draft, awaiting review',
      ),
    ]
  return [
    ...common,
    region('paint', 'icon', 'Paint', 0.08, 0.2, 0.13, 0.16),
    region('notepad', 'icon', 'Notepad', 0.08, 0.42, 0.13, 0.16),
    region('claims', 'icon', 'Legacy Claims Manager', 0.08, 0.64, 0.18, 0.16),
  ]
}
export function desktopSummary(d: MockDesktop): string {
  if (d.searchOpen) return `Start search: ${d.search || 'ready for an application name'}`
  if (d.app === 'Paint')
    return `Paint open. Canvas discovered. ${d.strokes.length} strokes drawn.${d.strokes.length >= 4 ? ' House and sun complete.' : ''}`
  if (d.app === 'Notepad') return `Notepad open. Document text: ${d.text || 'Empty document'}`
  if (d.app === 'Legacy Claims Manager')
    return `Legacy Claims Manager. Claim ${d.claimNumber || 'not entered'}. ${d.submitted ? 'Claim submitted' : 'Draft, awaiting review'}. Fictional data.`
  return 'Desktop ready. Paint, Notepad and Legacy Claims Manager are available.'
}
export const demoGoals = [
  {
    app: 'Paint',
    title: 'A little house. A little sun.',
    goal: 'Open Paint and draw a small house with a sun.',
    time: 'About 12 seconds',
    kind: 'Creative task',
  },
  {
    app: 'Notepad',
    title: 'A thought, written down.',
    goal: 'Open Notepad and write: The house is finished.',
    time: 'About 7 seconds',
    kind: 'Text entry',
  },
  {
    app: 'Legacy Claims Manager',
    title: 'Old software. New possibilities.',
    goal: 'Open Legacy Claims Manager and submit claim CLM-2048.',
    time: 'Pauses for your approval',
    kind: 'Human approval',
  },
] as const
