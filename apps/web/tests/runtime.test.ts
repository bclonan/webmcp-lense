import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ulid } from 'ulid'
import { LensService } from '../src/app/LensService'
import { demoRig, evaluationCases } from '../src/runtime/evals'
import {
  captureToNormalized,
  desktopToNormalized,
  normalizedToDesktop,
  resolveTarget,
} from '../src/screen/coordinates'
import {
  compileCartridge,
  starterCartridge,
  CartridgeService,
} from '../src/workflows/CartridgeService'
import { commandSchema, cartridgeSchema } from '@lens/schemas'
import { Repository } from '../src/persistence/Repository'
import type { CaptureGeometry } from '@lens/protocol'
beforeEach(() => setActivePinia(createPinia()))
describe('Product evaluations', () => {
  setActivePinia(createPinia())
  const registry = new LensService().tools
  for (const evaluation of evaluationCases(registry)) it(evaluation.name, evaluation.run)
})
describe('Execution boundaries', () => {
  it('does not claim to complete goals outside the demo scenarios', async () => {
    const r = demoRig()
    await r.bridge.connect()
    await r.runtime.run({ id: ulid(), text: 'Open Paint and email the image to everyone' })
    expect(r.runtime.state).toBe('failed')
    expect(r.desktop.revision).toBe(0)
  })
  it('requires a visible session enable action', async () => {
    const lens = new LensService()
    const result = await lens.tools.invoke('goal_start', { goal: 'Open Paint' })
    expect(result.ok).toBe(false)
    expect(lens.screen.desktop.revision).toBe(0)
  })
  it('rejects concurrent goals instead of queueing', async () => {
    const r = demoRig()
    await r.bridge.connect()
    const first = r.runtime.run({ id: ulid(), text: 'Open Paint' })
    await expect(r.runtime.run({ id: ulid(), text: 'Open Notepad' })).rejects.toThrow(
      'already active',
    )
    r.runtime.cancel()
    await first
    expect(r.runtime.state).toBe('cancelled')
  })
  it('denial never submits and leaves a receipt', async () => {
    const r = demoRig()
    await r.bridge.connect()
    r.state.onApproval = (a) => r.runtime.approve(a.id, false)
    await r.runtime.run({
      id: ulid(),
      text: 'Open Legacy Claims Manager and submit claim CLM-2048.',
    })
    expect(r.desktop.submitted).toBe(false)
    expect(r.runtime.state).toBe('failed')
    expect(r.events.some((e) => e.type === 'approval.denied')).toBe(true)
  })
  it('rejects a target that changed during approval', async () => {
    const r = demoRig()
    await r.bridge.connect()
    r.state.onApproval = (a) => {
      r.desktop.revision++
      r.runtime.approve(a.id, true)
    }
    await r.runtime.run({
      id: ulid(),
      text: 'Open Legacy Claims Manager and submit claim CLM-2048.',
    })
    expect(r.desktop.submitted).toBe(false)
    expect(r.events.at(-1)?.message).toContain('Screen changed during approval')
  })
  it('stop invalidates control and retains events', async () => {
    const lens = new LensService()
    await lens.enableDemo()
    lens.settings.stepDelay = 0
    const run = lens.startGoal('Open Paint')
    await lens.stop()
    await run.task
    expect(lens.session.authorized).toBe(false)
    expect(lens.bridgeState.status).toBe('stopped')
    expect(lens.session.events.some((e) => e.type === 'control.stopped')).toBe(true)
    expect(() => lens.startGoal('Open Paint')).toThrow('Enable control')
  })
  it('external cancellation clears an approval', async () => {
    const r = demoRig()
    await r.bridge.connect()
    const controller = new AbortController()
    r.state.onApproval = () => controller.abort()
    await r.runtime.run({ id: ulid(), text: 'Submit claim CLM-2048' }, undefined, controller.signal)
    expect(r.runtime.state).toBe('cancelled')
    expect(r.desktop.submitted).toBe(false)
    expect(r.state.approval).toBeNull()
  })
  it('blocks system command text before execution', async () => {
    const lens = new LensService()
    await lens.enableDemo()
    lens.settings.stepDelay = 0
    await lens.propose({ type: 'keyboard.text', text: 'powershell', description: 'Enter text' })
      .task
    expect(lens.runtimeState.state).toBe('failed')
    expect(lens.screen.desktop.revision).toBe(0)
  })
  it('strictly rejects extra arguments, unknown keys and ambiguous targets', async () => {
    const lens = new LensService()
    for (const [name, input] of [
      ['desktop_press', { key: 'WIN+R' }],
      ['desktop_click', { targetId: 'visual:start', point: { x: 0, y: 0 } }],
      ['desktop_drag', { points: [{ x: 0, y: 0 }], durationMs: 1 }],
    ] as const)
      expect((await lens.tools.invoke(name, input)).ok).toBe(false)
    expect(commandSchema.safeParse({ id: 'a', type: 'scroll', delta: Infinity }).success).toBe(
      false,
    )
  })
})
describe('Coordinates', () => {
  const geometry: CaptureGeometry = {
    captureWidth: 1280,
    captureHeight: 720,
    desktopBounds: { x: -2560, y: -1440, width: 2560, height: 1440 },
    displayScale: 2,
    calibrated: true,
  }
  it('maps endpoints without sending outside the monitor', () => {
    expect(normalizedToDesktop({ x: 1, y: 1 }, geometry)).toEqual({ x: -1, y: -1 })
    expect(normalizedToDesktop({ x: 0, y: 0 }, geometry)).toEqual({ x: -2560, y: -1440 })
  })
  it('round trips physical pixels', () => {
    const point = { x: -2111, y: -744 }
    expect(normalizedToDesktop(desktopToNormalized(point, geometry), geometry)).toEqual(point)
  })
  it('rejects uncalibrated, invalid and zero-size captures', () => {
    expect(() =>
      normalizedToDesktop({ x: 0.5, y: 0.5 }, { ...geometry, calibrated: false }),
    ).toThrow('Confirm')
    expect(() => normalizedToDesktop({ x: NaN, y: 0 }, geometry)).toThrow()
    expect(() => captureToNormalized({ x: 0, y: 0 }, { ...geometry, captureWidth: 0 })).toThrow()
  })
  it('does not fabricate missing targets', async () => {
    const observation = await demoRig().vision.observe()
    expect(() => resolveTarget('visual:missing', observation)).toThrow('not in the current')
  })
})
describe('Workflow and storage', () => {
  it('replays variables through the same approval flow', async () => {
    const plan = compileCartridge(starterCartridge, { claimNumber: 'CLM-9999' }),
      r = demoRig()
    await r.bridge.connect()
    r.state.onApproval = (a) => r.runtime.approve(a.id, true)
    await r.runtime.run(plan.goal, plan)
    expect(r.desktop.claimNumber).toBe('CLM-9999')
    expect(r.desktop.submitted).toBe(true)
    expect(r.runtime.state).toBe('completed')
  })
  it('records and replays Paint successfully', async () => {
    const r = demoRig()
    await r.bridge.connect()
    await r.runtime.run({ id: ulid(), text: 'Open Paint' })
    const recorder = new CartridgeService()
    recorder.start()
    r.events.forEach((e) => recorder.append(e))
    const cartridge = recorder.stop('Paint', 'Paint', 'House and sun complete')
    expect(cartridge.steps).toHaveLength(7)
    const plan = compileCartridge(cartridge, {})
    await r.runtime.run(plan.goal, plan)
    expect(r.runtime.state).toBe('completed')
    expect(r.desktop.strokes).toHaveLength(4)
  })
  it('rejects arbitrary actions and missing variables', () => {
    expect(
      cartridgeSchema.safeParse({
        ...starterCartridge,
        steps: [{ type: 'shell', text: 'anything' }],
      }).success,
    ).toBe(false)
    expect(() => compileCartridge({ ...starterCartridge, inputs: {} }, {})).toThrow('Missing')
  })
  it('stores an immutable append-only event log and cartridges', async () => {
    const repository = new Repository(),
      event = {
        id: ulid(),
        sessionId: 'test-session',
        timestamp: Date.now(),
        type: 'goal.started' as const,
        message: 'test',
      }
    await repository.append(event)
    await expect(repository.append(event)).rejects.toThrow()
    expect(await repository.events('test-session')).toContainEqual(event)
    await repository.saveCartridge(starterCartridge)
    expect((await repository.cartridges()).some((c) => c.id === starterCartridge.id)).toBe(true)
  })
  it('reload never hydrates authorization or starts a goal', async () => {
    const lens = new LensService()
    await lens.enableDemo()
    setActivePinia(createPinia())
    const reloaded = new LensService()
    await reloaded.init()
    expect(reloaded.session.authorized).toBe(false)
    expect(reloaded.bridgeState.status).toBe('disconnected')
    expect(reloaded.runtime.busy).toBe(false)
  })
})
