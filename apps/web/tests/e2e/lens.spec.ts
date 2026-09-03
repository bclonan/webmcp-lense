import { test, expect } from '@playwright/test'
test('root opens Workspace with visible tools, status and timeline', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/session$/)
  await expect(page.getByRole('link', { name: 'WebMCP status and tools' })).toContainText(
    '19 tools',
  )
  await expect(page.getByRole('heading', { name: 'WebMCP tools 19' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Event timeline/ })).toBeVisible()
  const timeline = await page.locator('.timeline').boundingBox()
  expect(timeline!.y).toBeLessThan(800)
  await page.getByRole('button', { name: 'screen_get_context read', exact: true }).click()
  await page.getByRole('button', { name: 'Call tool', exact: true }).click()
  await expect(page.getByLabel('Workspace tool result')).toContainText('fixture')
  await expect(page).toHaveURL(/\/session$/)
})
test('Paint completes with visible strokes and reload revokes control', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Run Paint demo' }).click()
  await expect(page.locator('.complete-label')).toHaveText('Goal completed')
  await expect(page.locator('.drawing-layer path')).toHaveCount(4)
  await expect(page.locator('.observation')).toContainText('House and sun complete')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable demo control' })).toBeVisible()
  await expect(page.locator('.status-strip')).toContainText('disconnected')
})
test('Notepad uses runtime text commands', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Run Notepad demo' }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  await expect(page.locator('.notepad-paper')).toContainText('The house is finished.')
})
test('Claims pauses, then human approval submits', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Run Claims demo' }).click()
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  await expect(page.locator('.claim-status')).toHaveText('Draft, awaiting review')
  await page.getByRole('button', { name: 'Approve action' }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  await expect(page.locator('.claim-status')).toHaveText('Claim submitted')
})
test('STOP clears pending approval and disables control', async ({ page }) => {
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Run Claims demo' }).click()
  await expect(page.getByRole('button', { name: 'Approve action' })).toBeVisible()
  await page.getByRole('button', { name: 'STOP CONTROL' }).click()
  await expect(page.locator('.approval-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enable demo control' })).toBeVisible()
  await expect(page.locator('.claim-status')).toHaveText('Draft, awaiting review')
  await expect(page.locator('.timeline')).toContainText('control.stopped')
})
test('record, replay, edit and export a cartridge', async ({ page }) => {
  await page.goto('/session')
  await page.getByRole('button', { name: 'Enable demo control' }).click()
  await page.getByRole('button', { name: 'Record Workflow', exact: true }).click()
  await page.getByRole('button', { name: 'Run goal', exact: true }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await page.getByRole('button', { name: 'Show workflows' }).click()
  const card = page.locator('.cartridge-card').filter({ hasText: 'My recorded workflow' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.locator('.complete-label')).toBeVisible()
  await expect(page.locator('.drawing-layer path')).toHaveCount(4)
  await card.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = card.getByLabel('Cartridge JSON')
  const json = JSON.parse(await editor.inputValue())
  json.name = 'House drawing'
  await editor.fill(JSON.stringify(json))
  await card.getByRole('button', { name: 'Save cartridge' }).click()
  const saved = page.locator('.cartridge-card').filter({ hasText: 'House drawing' })
  const download = page.waitForEvent('download')
  await saved.getByRole('button', { name: 'Export', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^lens-.*\.json$/)
})
test('local tools use validation and registered shared services', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.locator('[data-tool-name]')).toHaveCount(19)
  await page.getByRole('button', { name: 'Try screen_get_context', exact: true }).click()
  await page.getByRole('button', { name: 'Run read-only tool', exact: true }).click()
  await expect(page.getByLabel('Documentation tool result')).toContainText('fixture')
  await page.getByRole('button', { name: 'Preview desktop_type', exact: true }).click()
  await page.getByLabel('Preview arguments').fill('{"text":"hello","shell":true}')
  await page.getByRole('dialog').getByRole('button', { name: 'Validate arguments' }).click()
  await expect(page.getByRole('dialog').locator('pre[role="status"]')).toContainText(
    'VALIDATION_ERROR',
  )
})
test('all browser evaluations pass', async ({ page }) => {
  await page.goto('/evals')
  await page.getByRole('button', { name: 'Run evaluations' }).click()
  await expect(page.locator('.eval-row')).toHaveCount(12)
  await expect(page.locator('.eval-row .fail')).toHaveCount(0)
  await expect(page.locator('.eval-panel h2')).toContainText('12 of 12 checks passed')
})
test('native WebMCP adapter registers handlers with cleanup signals', async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Record<string, any> = {}
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: async (tool: any, options: any) => {
          tools[tool.name] = tool
          options.signal.addEventListener('abort', () => delete tools[tool.name])
        },
      },
    })
    ;(window as any).__nativeLensTools = tools
  })
  await page.goto('/session')
  await expect(page.locator('.status-strip')).toContainText('Native WebMCP')
  const result = await page.evaluate(async () => {
    const tools = (window as any).__nativeLensTools
    return { count: Object.keys(tools).length, result: await tools.screen_get_context.execute({}) }
  })
  expect(result.count).toBe(19)
  expect(result.result.data.source).toBe('fixture')
})
test('screen sharing persists across Lens pages and releases tracks on Stop sharing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as any).__captureCalls = 0
    ;(window as any).__trackStops = 0
    const original = document.createElement.bind(document)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: async () => {
          ;(window as any).__captureCalls++
          const canvas = original('canvas')
          canvas.width = 640
          canvas.height = 480
          canvas.getContext('2d')!.fillRect(0, 0, 640, 480)
          const stream = canvas.captureStream(1)
          stream.getTracks().forEach((t) => {
            const stop = t.stop.bind(t)
            t.stop = () => {
              ;(window as any).__trackStops++
              stop()
            }
          })
          return stream
        },
      },
    })
  })
  await page.goto('/session')
  expect(await page.evaluate(() => (window as any).__captureCalls)).toBe(0)
  await page.getByRole('button', { name: 'Desktop setup', exact: true }).click()
  await page.getByRole('button', { name: 'Choose screen', exact: true }).click()
  await page.getByRole('button', { name: 'Close desktop setup', exact: true }).click()
  await expect(page.getByLabel('Live shared screen')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__captureCalls)).toBe(1)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__trackStops)).toBe(0)
  await page.getByRole('link', { name: 'Workspace', exact: true }).click()
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__trackStops)).toBeGreaterThan(0)
})
test('mobile routes fit the viewport and load without script errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const route of ['/', '/demo', '/session', '/tools', '/evals', '/settings']) {
    await page.goto(route)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await expect(page.getByRole('button', { name: 'STOP CONTROL' })).toBeVisible()
  }
  expect(errors).toEqual([])
})
