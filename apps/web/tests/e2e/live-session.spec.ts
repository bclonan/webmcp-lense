import { test, expect, type Page } from '@playwright/test'

async function fixture(page: Page, platform: 'windows' | 'macos' | 'linux' = 'windows') {
  const state = { pairs: 0, executed: [] as any[], stops: 0, change: true }
  const width = platform === 'macos' ? 960 : 1920
  const height = platform === 'macos' ? 540 : 1080
  await page.addInitScript(() => {
    const w = window as any
    w.__lensTools = {}
    w.__clipboardWrites = []
    w.__clipboardReads = 0
    w.__captureCalls = 0
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: (t: any) => {
          w.__lensTools[t.name] = t
        },
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: async () => {
          w.__clipboardReads++
          return 'My private clipboard note'
        },
        writeText: async (text: string) => {
          w.__clipboardWrites.push(text)
        },
      },
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: async () => {
          w.__captureCalls++
          const canvas = document.createElement('canvas')
          canvas.width = 640
          canvas.height = 360
          const context = canvas.getContext('2d')!
          context.fillStyle = '#181818'
          context.fillRect(0, 0, 640, 360)
          let count = 0
          w.__desktopChange = () => {
            count++
            context.fillStyle = count % 2 ? '#444444' : '#181818'
            context.fillRect(10, 10, 65, 160)
          }
          return canvas.captureStream(10)
        },
      },
    })
  })
  await page.route('http://127.0.0.1:47653/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let value: any = { ok: true }
    if (path === '/pair') {
      state.pairs++
      value = {
        protocolVersion: 1,
        bridgeVersion: '0.2.0',
        sessionId: 'b'.repeat(32),
        timestamp: Date.now(),
        token: 'a'.repeat(64),
        expiresIn: 1800,
      }
    }
    if (path === '/capabilities')
      value = {
        protocolVersion: 1,
        bridgeVersion: '0.2.0',
        sessionId: 'b'.repeat(32),
        timestamp: Date.now(),
        device: platform,
        displayRevision: 'layout',
        keys:
          platform === 'macos'
            ? ['CTRL+C', 'CMD+C', 'CMD+A', 'CMD+V', 'CMD+S', 'CMD+W', 'CMD+SPACE', 'ENTER']
            : ['CTRL+C', 'ENTER'],
        platform,
        coordinateSpace: platform === 'macos' ? 'logical-points' : 'physical-pixels',
        desktopBounds: { x: -width, y: 0, width: width * 3, height },
        displayScale: 1,
        emergencyStop: true,
        commands: ['pointer.click', 'keyboard.text', 'keyboard.key', 'scroll', 'pointer.drag'],
        displays: [-width, 0, width].map((x, i) => ({
          id: `display-${i}`,
          name: `Display ${i}`,
          bounds: { x, y: 0, width, height },
          primary: x === 0,
        })),
      }
    if (path === '/execute') {
      const command = route.request().postDataJSON().command
      state.executed.push(command)
      if (state.change) await page.evaluate(() => (window as any).__desktopChange())
      value = {
        protocolVersion: 1,
        bridgeVersion: '0.2.0',
        sessionId: 'b'.repeat(32),
        timestamp: Date.now(),
        commandId: command.id,
        status: 'completed',
        result: { id: command.id, ok: true, executedAt: Date.now() },
      }
    }
    if (path === '/stop' || path === '/disconnect') state.stops++
    await route.fulfill({ json: value })
  })
  await page.goto('/session')
  return state
}
async function setup(page: Page, previousShares = 0) {
  await page.getByRole('button', { name: 'Desktop setup', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toContainText('Choose what Lens can see')
  expect(await page.evaluate(() => (window as any).__captureCalls)).toBe(previousShares)
  await modal.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await expect(modal).toContainText('Open Lens Bridge and copy its pairing code.')
  await modal.getByLabel('Pairing code', { exact: true }).fill('fixture-code')
  await modal.getByRole('button', { name: 'Pair bridge', exact: true }).click()
  await modal.getByLabel('Shared monitor', { exact: true }).selectOption('display-1')
  await modal.getByRole('button', { name: 'Confirm shared monitor', exact: true }).click()
  await expect(modal).toContainText('Ready to work together')
  await modal.getByRole('button', { name: 'Finish setup', exact: true }).click()
}
async function invoke(page: Page, name: string, input: any = {}) {
  return page.evaluate(
    async ({ name, input }) => (window as any).__lensTools[name].execute(input),
    { name, input },
  )
}
const sequence = {
  name: 'Menu sequence',
  steps: [
    { type: 'click', point: { x: 0.02, y: 0.02 } },
    { type: 'click', point: { x: 0.04, y: 0.08 } },
  ],
}

test('New session cancels a pending native sequence, stops sharing and resets workspace drafts', async ({
  page,
}) => {
  const state = await fixture(page)
  await setup(page)
  const run = invoke(page, 'desktop_run_sequence', sequence)
  await expect(page.getByRole('button', { name: 'Approve action', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await run
  await expect(page.getByText('New session ready.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable demo control', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve action', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Live shared screen')).toHaveCount(0)
  expect(state.executed).toHaveLength(0)
  expect(state.stops).toBeGreaterThan(0)
  const status = await invoke(page, 'goal_status')
  expect(status.data).toMatchObject({
    busy: false,
    state: 'idle',
    authorized: false,
    bridge: 'disconnected',
  })
  await setup(page, 1)
  expect(state.pairs).toBe(2)
})

test('Windows preview download is available beside desktop setup and the modal heading', async ({
  page,
}) => {
  await fixture(page)
  const download = page.getByRole('link', { name: 'Download Windows bridge', exact: true })
  await expect(download).toHaveAttribute(
    'href',
    /\/downloads\/Lens-Bridge-.*-windows-x64-development\.exe$/,
  )
  await expect(
    page.locator('.workspace-actions').getByText(/Unsigned development preview/),
  ).toBeVisible()
  const completed = page.waitForEvent('download')
  await download.click()
  expect((await completed).suggestedFilename()).toMatch(/-windows-x64-development\.exe$/)
  await page.getByRole('button', { name: 'Desktop setup', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(
    modal.getByRole('link', { name: 'Download Windows bridge', exact: true }),
  ).toBeVisible()
  await modal.getByLabel('Download operating system').selectOption('macos')
  await expect(
    modal.getByText('A verified download for this platform has not been published yet.'),
  ).toBeVisible()
  await expect(modal.getByRole('link', { name: 'Download for macOS', exact: true })).toHaveCount(0)
})

test('download manifest failures can be retried without reloading the workspace', async ({
  page,
}) => {
  await page.route(
    '**/bridge-releases.json',
    (route) => route.fulfill({ status: 503, body: 'Unavailable' }),
    { times: 1 },
  )
  await fixture(page)
  await page.getByRole('button', { name: 'Desktop setup', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('button', { name: 'Retry downloads', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Retry downloads', exact: true }).click()
  await expect(modal.getByRole('link', { name: 'Download for Windows', exact: true })).toBeVisible()
})

test('pairing error explains a version mismatch and a fresh attempt can succeed', async ({
  page,
}) => {
  await fixture(page)
  await page.route(
    'http://127.0.0.1:47653/pair',
    (route) =>
      route.fulfill({
        status: 400,
        json: {
          error: {
            code: 'protocol_mismatch',
            message: 'Reload the Lens page to update its protocol.',
          },
        },
      }),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Desktop setup', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await modal.getByLabel('Pairing code', { exact: true }).fill('fixture-code')
  await modal.getByRole('button', { name: 'Pair bridge', exact: true }).click()
  await expect(modal.getByRole('alert')).toContainText('Reload the Lens page')
  await expect(modal).not.toContainText('[object Object]')
  await expect(modal.getByRole('button', { name: 'Reload Lens', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Pair bridge', exact: true }).click()
  await expect(modal.getByLabel('Shared monitor', { exact: true })).toBeVisible()
})

test('a newly deployed version offers a reload without interrupting sharing', async ({ page }) => {
  await page.route('**/app-version.json', (route) =>
    route.fulfill({ json: { buildId: 'newer-deployment', protocolVersion: 1 } }),
  )
  await fixture(page)
  await expect(page.getByRole('button', { name: 'Reload to update', exact: true })).toBeVisible()
  await setup(page)
  expect(await page.evaluate(() => (window as any).__captureCalls)).toBe(1)
  await expect(page.getByLabel('Live shared screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload to update', exact: true })).toBeVisible()
})

for (const platform of ['macos', 'linux'] as const) {
  test(`${platform} companion pairs and exposes the correct keyboard choices`, async ({ page }) => {
    const state = await fixture(page, platform)
    await setup(page)
    await page.getByLabel('Action', { exact: true }).selectOption('press')
    const options = await page
      .getByLabel('Key', { exact: true })
      .locator('option')
      .allTextContents()
    expect(options.includes('CMD+SPACE')).toBe(platform === 'macos')
    await invoke(page, 'desktop_click', { point: { x: 0.5, y: 0.5 } })
    await page.getByRole('button', { name: 'Approve action', exact: true }).click()
    await expect(page.locator('.complete-label')).toBeVisible()
    expect(state.executed[0].point).toEqual(
      platform === 'macos' ? { x: 480, y: 270 } : { x: 960, y: 540 },
    )
    expect(state.pairs).toBe(1)
  })
}

test('guided setup, sequential approvals, navigation and explicit rerun retain one pairing', async ({
  page,
}) => {
  test.setTimeout(45000)
  const state = await fixture(page)
  await setup(page)
  expect((await invoke(page, 'desktop_run_sequence', sequence)).ok).toBe(true)
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  expect(state.executed).toHaveLength(0)
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.locator('.sequence-progress')).toHaveText('Step 2 of 2')
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  expect(state.executed).toHaveLength(1)
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  expect(state.executed).toHaveLength(2)
  expect(state.executed[0].point.x).toBe(38)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await expect(page.locator('.connection-banner')).toContainText('Desktop paired')
  await page.getByRole('link', { name: 'Workspace', exact: true }).click()
  await page.getByText('Run again', { exact: true }).click()
  await page.getByRole('button', { name: 'Rerun from first step' }).click()
  await expect(page.locator('.sequence-progress')).toHaveText('Step 1 of 2')
  expect(state.executed).toHaveLength(2)
  await page.getByRole('button', { name: 'Deny', exact: true }).click()
  await expect(page.locator('.runtime-card')).toContainText('Pairing is still active')
  expect(state.pairs).toBe(1)
  expect(state.stops).toBe(0)
})

test('unverified action stops a sequence and the next explicit action reuses pairing', async ({
  page,
}) => {
  const state = await fixture(page)
  await setup(page)
  state.change = false
  await invoke(page, 'desktop_run_sequence', sequence)
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.locator('.runtime-card')).toContainText('No screen change detected')
  expect(state.executed).toHaveLength(1)
  expect((await invoke(page, 'goal_status')).data.authorized).toBe(true)
  state.change = true
  await invoke(page, 'desktop_click', { point: { x: 0.04, y: 0.08 } })
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  expect(state.pairs).toBe(1)
})

test('sequence builder validates steps and STOP clears approval', async ({ page }) => {
  const state = await fixture(page)
  await setup(page)
  await page.getByLabel('Action', { exact: true }).selectOption('click')
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await page.getByLabel('Horizontal %', { exact: true }).fill('30')
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await page.getByRole('button', { name: 'Review 2 steps in order' }).click()
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  await page.getByRole('button', { name: 'STOP CONTROL', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Approve action' })).toHaveCount(0)
  expect(state.executed).toHaveLength(0)
  expect(state.stops).toBe(1)
  await page.getByRole('button', { name: 'Review this action' }).click()
  await expect(page.getByRole('dialog')).toContainText('Start the desktop companion')
})

test('clipboard proposals require the visible copy button and reads stay local', async ({
  page,
}) => {
  await fixture(page)
  await invoke(page, 'browser_clipboard_propose_write', { text: 'Agent draft for review' })
  expect(await page.evaluate(() => (window as any).__clipboardWrites)).toEqual([])
  expect(await page.evaluate(() => (window as any).__clipboardReads)).toBe(0)
  await page.getByRole('button', { name: 'Copy approved text', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__clipboardWrites)).toEqual([
    'Agent draft for review',
  ])
  await page.getByRole('button', { name: 'Read clipboard text', exact: true }).click()
  await expect(page.getByLabel('Clipboard text to review')).toHaveValue('My private clipboard note')
  const events = await invoke(page, 'session_get_events', { limit: 200 })
  expect(JSON.stringify(events)).not.toContain('My private clipboard note')
})

test('setup fits mobile, closes with Escape and restores focus', async ({ page }) => {
  await fixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const opener = page.getByRole('button', { name: 'Desktop setup', exact: true })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(opener).toBeFocused()
})
