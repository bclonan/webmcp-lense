import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalDesktopBridge } from '../src/bridge/LocalDesktopBridge'
const common = {
  protocolVersion: 1,
  bridgeVersion: '0.2.0',
  sessionId: 'b'.repeat(32),
  timestamp: Date.now(),
}
const pair = { ...common, token: 'a'.repeat(64), expiresIn: 1800 }
const capabilities = {
  ...common,
  device: 'windows x64',
  displayRevision: 'layout-1',
  platform: 'windows',
  desktopBounds: { x: 0, y: 0, width: 1920, height: 1080 },
  displayScale: 1,
  commands: ['pointer.move'],
  keys: ['ENTER'],
  emergencyStop: true,
}
afterEach(() => vi.unstubAllGlobals())
function transport(execute: (body: any) => unknown, customPair = pair) {
  const calls: { path: string; body: any }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname,
        body = JSON.parse(init.body as string)
      calls.push({ path, body })
      return Response.json(
        path === '/pair'
          ? customPair
          : path === '/capabilities'
            ? capabilities
            : path === '/execute'
              ? execute(body)
              : { ok: true },
      )
    }),
  )
  return calls
}
describe('Native wire protocol', () => {
  it('rejects a different protocol before capability exchange or input', async () => {
    const calls = transport(
      () => {
        throw new Error('unexpected input')
      },
      { ...pair, protocolVersion: 2 },
    )
    await expect(new LocalDesktopBridge('code').connect()).rejects.toThrow('protocol mismatch')
    expect(calls.map((c) => c.path)).toEqual(['/pair'])
  })
  it('sends the negotiated session and display revision and validates the receipt', async () => {
    const calls = transport((body) => ({
      ...common,
      commandId: body.command.id,
      status: 'completed',
      result: { id: body.command.id, ok: true, executedAt: Date.now() },
    }))
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    await bridge.capabilities()
    expect(
      (await bridge.execute({ id: 'move-1', type: 'pointer.move', point: { x: 10, y: 20 } })).ok,
    ).toBe(true)
    expect(calls.at(-1)?.body).toMatchObject({
      protocolVersion: 1,
      sessionId: common.sessionId,
      displayRevision: 'layout-1',
      command: { id: 'move-1' },
    })
    await bridge.disconnect()
    await expect(
      bridge.execute({ id: 'move-2', type: 'pointer.move', point: { x: 10, y: 20 } }),
    ).rejects.toThrow('not paired')
  })
  it('rejects unsupported capabilities without sending a command', async () => {
    const calls = transport(() => {
      throw new Error('unexpected input')
    })
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    await bridge.capabilities()
    await expect(
      bridge.execute({ id: 'type', type: 'keyboard.text', text: 'test' }),
    ).rejects.toThrow('does not support')
    expect(calls.some((c) => c.path === '/execute')).toBe(false)
  })
  it('rejects a receipt from another session', async () => {
    transport((body) => ({
      ...common,
      sessionId: 'c'.repeat(32),
      commandId: body.command.id,
      status: 'completed',
      result: { id: body.command.id, ok: true, executedAt: Date.now() },
    }))
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    await bridge.capabilities()
    await expect(
      bridge.execute({ id: 'move', type: 'pointer.move', point: { x: 10, y: 20 } }),
    ).rejects.toThrow('unexpected command receipt')
  })
})
