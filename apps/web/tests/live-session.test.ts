import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LensService } from '../src/app/LensService'
import type { DesktopCommand } from '@lens/protocol'

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const bounds = { x: 0, y: 0, width: 1920, height: 1080 }
async function paired() {
  const lens = new LensService(),
    commands: DesktopCommand[] = [],
    paths: string[] = []
  lens.session.mode = 'live'
  lens.screen.sharing = true
  lens.settings.stepDelay = 0
  lens.screen.geometry = {
    captureWidth: 1920,
    captureHeight: 1080,
    desktopBounds: bounds,
    displayScale: 1,
    calibrated: false,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname
      paths.push(path)
      if (path === '/pair') return Response.json({ token: 'a'.repeat(64), expiresIn: 1800 })
      if (path === '/capabilities')
        return Response.json({
          platform: 'windows',
          desktopBounds: bounds,
          displays: [{ id: 'one', name: 'Main display', bounds, primary: true }],
          displayScale: 1,
          commands: ['pointer.click'],
          emergencyStop: true,
        })
      if (path === '/execute') {
        const command = JSON.parse(init.body as string)
        commands.push(command)
        lens.screen.changeRevision++
        return Response.json({ id: command.id, ok: true, executedAt: Date.now() })
      }
      return Response.json({ ok: true })
    }),
  )
  await lens.pairBridge('test-code')
  lens.confirmMapping()
  return { lens, commands, paths }
}
const sequence = {
  name: 'Two clicks',
  steps: [
    { type: 'click', point: { x: 0.1, y: 0.2 } },
    { type: 'click', point: { x: 0.3, y: 0.4 } },
  ],
}
async function approval(lens: LensService, previous?: string) {
  await vi.waitFor(
    () => {
      expect(lens.approvals.pending).not.toBeNull()
      expect(lens.approvals.pending?.id).not.toBe(previous)
    },
    { interval: 5, timeout: 5000 },
  )
  return lens.approvals.pending!.id
}
describe('Paired sequential sessions', () => {
  it('continues after a copy command with a receipt instead of demanding visual change', async () => {
    const { lens, commands } = await paired()
    const changed = vi.spyOn(lens, 'waitForChange')
    const run = lens.runSequence({
      name: 'Copy then click',
      steps: [{ type: 'press', key: 'CTRL+C' }, sequence.steps[0]],
    })
    const first = await approval(lens)
    lens.runtime.approve(first, true)
    lens.runtime.approve(await approval(lens, first), true)
    await run.task
    expect(commands).toHaveLength(2)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(
      lens.session.events.some((e) => e.message.includes('clipboard contents are not asserted')),
    ).toBe(true)
  })
  it('runs steps in order, asks for each approval, and reruns without pairing again', async () => {
    const { lens, commands, paths } = await paired()
    const run = lens.runSequence(sequence)
    const first = await approval(lens)
    expect(commands).toHaveLength(0)
    expect(() => lens.runSequence(sequence)).toThrow('already active')
    lens.runtime.approve(first, true)
    const second = await approval(lens, first)
    expect(commands).toHaveLength(1)
    expect(lens.runtimeState.step).toBe(2)
    lens.runtime.approve(second, true)
    await run.task
    expect(commands.map((c) => ('point' in c ? c.point.x : 0))).toEqual([192, 576])
    expect(lens.runtimeState.state).toBe('completed')
    expect(lens.session.authorized).toBe(true)
    const again = lens.rerunLast()
    const third = await approval(lens, second)
    expect(commands).toHaveLength(2)
    lens.runtime.approve(third, true)
    lens.runtime.approve(await approval(lens, third), true)
    await again.task
    expect(commands).toHaveLength(4)
    expect(new Set(commands.map((c) => c.id)).size).toBe(4)
    expect(paths.filter((p) => p === '/pair')).toHaveLength(1)
  })
  it('stops after an unverified result and keeps pairing for an explicit fresh run', async () => {
    const { lens, commands, paths } = await paired()
    vi.spyOn(lens, 'waitForChange').mockRejectedValueOnce(new Error('No screen change detected'))
    const run = lens.runSequence(sequence)
    lens.runtime.approve(await approval(lens), true)
    await run.task
    expect(commands).toHaveLength(1)
    expect(lens.runtimeState.state).toBe('failed')
    expect(lens.session.authorized).toBe(true)
    expect(paths).not.toContain('/stop')
    expect(lens.runtimeState.failure).toContain('No screen change')
  })
  it('denies or cancels pending work without revoking the healthy connection', async () => {
    const { lens, commands, paths } = await paired()
    const denied = lens.runSequence(sequence)
    lens.runtime.approve(await approval(lens), false)
    await denied.task
    const cancelled = lens.runSequence(sequence)
    await approval(lens)
    await lens.cancelGoal()
    await cancelled.task
    expect(commands).toHaveLength(0)
    expect(lens.session.authorized).toBe(true)
    expect(paths).not.toContain('/stop')
  })
  it('rejects stale approval without executing or requiring another pairing', async () => {
    const { lens, commands } = await paired()
    const run = lens.runSequence(sequence)
    const id = await approval(lens)
    lens.screen.changeRevision++
    lens.runtime.approve(id, true)
    await run.task
    expect(commands).toHaveLength(0)
    expect(lens.runtimeState.failure).toContain('Screen changed during approval')
    expect(lens.session.authorized).toBe(true)
  })
  it('revokes input and opens setup after a bridge transport failure', async () => {
    const { lens, paths } = await paired()
    vi.spyOn(lens.bridge, 'execute').mockRejectedValue(new Error('Connection lost'))
    const run = lens.runSequence(sequence)
    lens.runtime.approve(await approval(lens), true)
    await run.task
    expect(lens.session.authorized).toBe(false)
    expect(lens.bridgeState.status).toBe('disconnected')
    expect(lens.session.setupOpen).toBe(true)
    expect(paths).toContain('/stop')
  })
  it('STOP revokes pairing and discards all remaining steps', async () => {
    const { lens, commands, paths } = await paired()
    const run = lens.runSequence(sequence)
    await approval(lens)
    await lens.stop()
    await run.task
    expect(commands).toHaveLength(0)
    expect(lens.session.authorized).toBe(false)
    expect(paths).toContain('/stop')
    expect(() => lens.rerunLast()).toThrow('Enable control')
  })
  it('external cancellation stops an in-flight native command before any later step', async () => {
    const { lens, paths } = await paired()
    const controller = new AbortController()
    let finish!: () => void
    const execute = vi.spyOn(lens.bridge, 'execute').mockImplementation(
      (command) =>
        new Promise((resolve) => {
          finish = () => resolve({ id: command.id, ok: true, executedAt: Date.now() })
        }),
    )
    const run = lens.runSequence(sequence, controller.signal)
    lens.runtime.approve(await approval(lens), true)
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1), { interval: 5 })
    controller.abort()
    expect(lens.session.authorized).toBe(false)
    expect(paths).toContain('/stop')
    finish()
    await run.task
    expect(execute).toHaveBeenCalledTimes(1)
    expect(lens.runtimeState.state).toBe('cancelled')
  })
  it('opens setup on expiry and rejects a whole-desktop mapping for a single monitor', async () => {
    const { lens } = await paired()
    lens.bridgeState.capabilities!.desktopBounds = { x: -1920, y: 0, width: 5760, height: 1080 }
    lens.screen.geometry.desktopBounds = { ...lens.bridgeState.capabilities!.desktopBounds }
    expect(() => lens.confirmMapping()).toThrow('single monitor')
    vi.spyOn(lens.bridge, 'capabilities').mockRejectedValue(new Error('Expired'))
    await lens.checkConnection()
    expect(lens.session.setupOpen).toBe(true)
    expect(lens.session.authorized).toBe(false)
  })
  it('rejects duplicate pairing calls and invalid sequences', async () => {
    const { lens, paths } = await paired()
    await lens.pairBridge('already-consumed')
    expect(paths.filter((p) => p === '/pair')).toHaveLength(1)
    expect(() => lens.runSequence({ name: 'Bad', steps: [{ type: 'click' }] })).toThrow()
    expect(() =>
      lens.runSequence({
        name: 'Too many',
        steps: Array(21).fill({ type: 'press', key: 'ENTER' }),
      }),
    ).toThrow()
    expect(() =>
      lens.runSequence({ name: 'Bad', steps: [{ type: 'shell', text: 'whoami' }] }),
    ).toThrow()
  })
})
