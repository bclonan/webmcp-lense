import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalDesktopBridge } from '../src/bridge/LocalDesktopBridge'
import { errorMessage } from '../src/bridge/errors'
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
  it('renders structured and legacy errors without object coercion', async () => {
    for (const value of [
      { error: { code: 'protocol_mismatch', message: 'Reload the Lens page.' } },
      { error: 'Reload the Lens page.', errorCode: 'protocol_mismatch' },
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(value, { status: 400 })),
      )
      await expect(new LocalDesktopBridge('code').connect()).rejects.toMatchObject({
        code: 'protocol_mismatch',
        message: 'Reload the Lens page.',
      })
    }
    expect(errorMessage({ error: { message: 'Readable failure' } })).toBe('Readable failure')
    expect(errorMessage({ unexpected: true })).not.toContain('[object Object]')
  })
  it('explains an older companion instead of downgrading the protocol', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ error: 'Expected only a pairing code' }, { status: 400 }),
    )
    vi.stubGlobal('fetch', fetch)
    await expect(new LocalDesktopBridge('code').connect()).rejects.toMatchObject({
      code: 'protocol_mismatch',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not retry an uncertain pairing request', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetch)
    await expect(new LocalDesktopBridge('code').connect()).rejects.toThrow('New pairing code')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('retries one transient capability failure without re-pairing and shares concurrent checks', async () => {
    let checks = 0,
      pairs = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/pair')) {
          pairs++
          return Response.json(pair)
        }
        if (++checks === 1) return new Response('temporarily unavailable', { status: 503 })
        return Response.json(capabilities)
      }),
    )
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    const [a, b] = await Promise.all([bridge.capabilities(), bridge.capabilities()])
    expect(a).toEqual(b)
    expect(checks).toBe(2)
    expect(pairs).toBe(1)
  })
  it('does not retry authorization rejection or malformed successful replies', async () => {
    for (const reply of [
      () =>
        Response.json(
          { error: { code: 'session_expired', message: 'Pair again' } },
          { status: 401 },
        ),
      () => new Response('<html>Wrong service</html>'),
    ]) {
      let checks = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.endsWith('/pair')) return Response.json(pair)
          checks++
          return reply()
        }),
      )
      const bridge = new LocalDesktopBridge('code')
      await bridge.connect()
      await expect(bridge.capabilities()).rejects.toThrow()
      expect(checks).toBe(1)
    }
  })
  it('never replays input after a timeout', async () => {
    let executed = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/pair')) return Response.json(pair)
        if (url.endsWith('/capabilities')) return Response.json(capabilities)
        executed++
        throw new DOMException('timeout', 'TimeoutError')
      }),
    )
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    await bridge.capabilities()
    await expect(
      bridge.execute({ id: 'move', type: 'pointer.move', point: { x: 10, y: 10 } }),
    ).rejects.toThrow('may already have happened')
    expect(executed).toBe(1)
  })
  it('does not restore capability state when a response arrives after disconnect', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/pair')) return Response.json(pair)
        if (url.endsWith('/capabilities'))
          return new Promise<Response>((resolve) => {
            finish = resolve
          })
        return Response.json({ ok: true })
      }),
    )
    const bridge = new LocalDesktopBridge('code')
    await bridge.connect()
    const read = bridge.capabilities()
    await bridge.disconnect()
    finish(Response.json(capabilities))
    await expect(read).rejects.toThrow('cancelled')
    await expect(
      bridge.execute({ id: 'move', type: 'pointer.move', point: { x: 10, y: 10 } }),
    ).rejects.toThrow('not paired')
  })
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
