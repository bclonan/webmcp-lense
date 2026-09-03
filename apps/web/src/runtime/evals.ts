import { ulid } from 'ulid'
import { freshDesktop } from '@lens/fixtures'
import { commandSchema } from '@lens/schemas'
import type { CaptureGeometry, PendingApproval, RuntimeEvent } from '@lens/protocol'
import { MockDesktopBridge } from '../bridge/MockDesktopBridge'
import { MockVisionProvider } from '../vision/MockVisionProvider'
import { ComputerRuntime } from './ComputerRuntime'
import { DemoPlannerProvider } from './DemoPlannerProvider'
import { PolicyEngine } from '../policy/PolicyEngine'
import { captureToNormalized, normalizedToDesktop, resolveTarget } from '../screen/coordinates'
import { VisualChangeDetector } from '../screen/VisualChangeDetector'
import type { ToolRegistry } from '../webmcp/ToolRegistry'
import { registerNativeTools } from '../webmcp/nativeAdapter'
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
export function demoRig() {
  const desktop = freshDesktop(),
    bridge = new MockDesktopBridge(desktop),
    vision = new MockVisionProvider(desktop),
    events: RuntimeEvent[] = []
  const state = {
    approval: null as PendingApproval | null,
    onApproval: undefined as ((a: PendingApproval) => void) | undefined,
  }
  const runtime = new ComputerRuntime(bridge, new DemoPlannerProvider(), {
    observe: () => vision.observe(),
    changed: async (before, signal) => {
      signal.throwIfAborted()
      const after = await vision.observe()
      if (after.revision === before.revision) throw new Error('No screen change')
      return after
    },
    geometry: () => ({
      captureWidth: 1001,
      captureHeight: 701,
      desktopBounds: { x: 0, y: 0, width: 1001, height: 701 },
      displayScale: 1,
      calibrated: true,
    }),
    state: () => {},
    event: (type, message, data) =>
      events.push({ id: ulid(), sessionId: 'eval', timestamp: Date.now(), type, message, data }),
    proposed: () => {},
    policy: () => {},
    native: () => false,
    pace: () => 0,
    approval: (a) => {
      state.approval = a
      if (a) state.onApproval?.(a)
    },
  })
  return { desktop, bridge, vision, events, state, runtime }
}
export interface EvalResult {
  name: string
  status: 'PASS' | 'FAIL'
  detail: string
  durationMs: number
}
export function evaluationCases(registry: ToolRegistry) {
  const checks: { name: string; run: () => Promise<void> | void }[] = [
    {
      name: 'WebMCP tool registration',
      run: async () => {
        const names: string[] = []
        let removed = false
        const stop = await registerNativeTools(registry, {
          modelContext: {
            registerTool: async (t, o) => {
              names.push(t.name)
              o.signal.addEventListener('abort', () => {
                removed = true
              })
            },
          },
        })
        check(
          names.length === 19 && new Set(names).size === 19,
          'Expected 19 distinct native tool registrations',
        )
        stop()
        check(removed, 'Registration must support abort cleanup')
      },
    },
    {
      name: 'Strict schema validation',
      run: async () => {
        const r = await registry.invoke('desktop_type', { text: 'hello', execute: 'powershell' })
        check(
          !r.ok && r.error.code === 'VALIDATION_ERROR',
          'Unknown properties must fail before actuation',
        )
        check(
          !commandSchema.safeParse({ id: 'test', type: 'shell', text: 'anything' }).success,
          'Shell must be rejected',
        )
      },
    },
    {
      name: 'Semantic target resolution',
      run: async () => {
        const rig = demoRig()
        rig.desktop.app = 'Paint'
        const p = resolveTarget('visual:canvas', await rig.vision.observe())
        check(Math.abs(p.x - 0.5) < 0.0001 && Math.abs(p.y - 0.555) < 0.0001, 'Wrong canvas center')
      },
    },
    {
      name: 'Coordinate scaling and negative origins',
      run: () => {
        const g: CaptureGeometry = {
          captureWidth: 960,
          captureHeight: 540,
          displayScale: 1.5,
          calibrated: true,
          desktopBounds: { x: -1920, y: -100, width: 1920, height: 1080 },
        }
        const p = normalizedToDesktop(captureToNormalized({ x: 480, y: 270 }, g), g)
        check(p.x === -960 && p.y === 440, 'Incorrect physical pixel mapping')
      },
    },
    {
      name: 'Policy ALLOW',
      run: async () => {
        const o = await demoRig().vision.observe()
        check(
          new PolicyEngine().evaluate({ type: 'scroll', delta: 120, description: 'Scroll view' }, o)
            .decision === 'ALLOW',
          'Ordinary scrolling should be allowed',
        )
      },
    },
    {
      name: 'Policy ASK',
      run: async () => {
        const rig = demoRig()
        rig.desktop.app = 'Legacy Claims Manager'
        check(
          new PolicyEngine().evaluate(
            { type: 'pointer.click', targetId: 'visual:submit-claim', description: 'Click target' },
            await rig.vision.observe(),
          ).decision === 'ASK',
          'Consequential targets require approval',
        )
      },
    },
    {
      name: 'Policy BLOCK',
      run: async () => {
        check(
          new PolicyEngine().evaluate(
            { type: 'keyboard.text', text: 'powershell', description: 'Run system command' },
            await demoRig().vision.observe(),
          ).decision === 'BLOCK',
          'Unsafe intent must be blocked',
        )
      },
    },
    {
      name: 'Approval gates execution',
      run: async () => {
        const r = demoRig()
        await r.bridge.connect()
        let asked = false
        r.state.onApproval = (a) => {
          asked = true
          check(!r.desktop.submitted, 'Submission occurred before approval')
          r.runtime.approve(a.id, true)
        }
        await r.runtime.run({
          id: ulid(),
          text: 'Open Legacy Claims Manager and submit claim CLM-2048.',
        })
        check(
          asked && r.desktop.submitted && r.runtime.state === 'completed',
          'Approved claims flow did not complete',
        )
      },
    },
    {
      name: 'Cancel clears pending work',
      run: async () => {
        const r = demoRig()
        await r.bridge.connect()
        r.state.onApproval = () => r.runtime.cancel()
        await r.runtime.run({
          id: ulid(),
          text: 'Open Legacy Claims Manager and submit claim CLM-2048.',
        })
        check(
          r.runtime.state === 'cancelled' && !r.desktop.submitted && !r.state.approval,
          'Cancelled approval must not execute',
        )
      },
    },
    {
      name: 'Local screen-change detection',
      run: () => {
        const d = new VisualChangeDetector(0.1),
          a = new Uint8ClampedArray(16).fill(0),
          b = new Uint8ClampedArray(16).fill(255)
        check(!d.compare(a).changed, 'First frame establishes baseline')
        check(!d.compare(a).changed, 'Identical frames are not changes')
        check(d.compare(b).changed, 'Large change was not detected')
      },
    },
    {
      name: 'Paint and Notepad completion',
      run: async () => {
        for (const goal of [
          'Open Paint and draw a small house with a sun.',
          'Open Notepad and write: The house is finished.',
        ]) {
          const r = demoRig()
          await r.bridge.connect()
          await r.runtime.run({ id: ulid(), text: goal })
          check(r.runtime.state === 'completed', r.events.at(-1)?.message ?? 'Incomplete')
          check(
            r.desktop.app === 'Paint'
              ? r.desktop.strokes.length === 4
              : r.desktop.text === 'The house is finished.',
            'Expected visible output missing',
          )
        }
      },
    },
    {
      name: 'Bridge failure stops the runtime',
      run: async () => {
        const r = demoRig()
        await r.bridge.connect()
        r.bridge.failNext = true
        await r.runtime.run({ id: ulid(), text: 'Open Paint' })
        check(
          r.runtime.state === 'failed' && r.desktop.revision === 0,
          'Bridge failure must prevent subsequent actions',
        )
      },
    },
  ]
  return checks
}
export async function runEvaluations(registry: ToolRegistry, onResult: (r: EvalResult) => void) {
  const initial = { ...registry.status }
  try {
    for (const c of evaluationCases(registry)) {
      const start = performance.now()
      try {
        await c.run()
        onResult({
          name: c.name,
          status: 'PASS',
          detail: 'Expected behavior verified.',
          durationMs: Math.round(performance.now() - start),
        })
      } catch (e) {
        onResult({
          name: c.name,
          status: 'FAIL',
          detail: String(e),
          durationMs: Math.round(performance.now() - start),
        })
      }
    }
  } finally {
    Object.assign(registry.status, initial)
  }
}
