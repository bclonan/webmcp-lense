import { test, expect } from '@playwright/test'
async function nativeTools(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const tools: Record<string, any> = {}
    ;(window as any).__docsTools = tools
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: (tool: any, options: any) => {
          tools[tool.name] = tool
          options.signal.addEventListener('abort', () => delete tools[tool.name])
        },
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value: string) => {
          ;(window as any).__copied = value
        },
      },
    })
  })
}
test('catalog coverage, copying, read-only testing and mutation preview use the real registry', async ({
  page,
}) => {
  await nativeTools(page)
  await page.goto('/webmcp')
  const names = await page.evaluate(() => Object.keys((window as any).__docsTools))
  expect(
    await page
      .locator('[data-tool-name]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tool-name'))),
  ).toEqual(names)
  await expect(page.locator('[data-tool-name]')).toHaveCount(19)
  const status = page.locator('[data-tool-name="goal_status"]')
  await status.getByRole('button', { name: 'Copy tool name', exact: true }).click()
  await expect(status.getByText('Copied.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as any).__copied)).toBe('goal_status')
  await status.getByRole('button', { name: 'Try goal_status', exact: true }).click()
  await status.getByRole('button', { name: 'Run read-only tool', exact: true }).click()
  await expect(status.getByLabel('Documentation tool result')).toContainText('idle')
  await page.getByRole('button', { name: 'Preview desktop_type', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Review this operation' })
  await expect(preview).toContainText('This preview sends no action')
  await preview.getByLabel('Preview arguments').fill('{"text":"Hello","shell":true}')
  await preview.getByRole('button', { name: 'Validate arguments' }).click()
  await expect(preview.locator('pre[role="status"]')).toContainText('VALIDATION_ERROR')
  expect(
    await page.evaluate(() => (window as any).__docsTools.goal_status.execute({})),
  ).toMatchObject({ data: { state: 'idle', authorized: false } })
  await page.keyboard.press('Escape')
  await expect(preview).not.toBeVisible()
  await page.getByRole('link', { name: 'Hackathon', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('link', { name: 'Workspace', exact: true }).click()
  expect(await page.evaluate(() => Object.keys((window as any).__docsTools))).toEqual(names)
  await page.getByRole('button', { name: 'Enable demo control', exact: true }).click()
  await page.evaluate(() =>
    (window as any).__docsTools.goal_start.execute({
      goal: 'Open Paint and draw a small house with a sun.',
    }),
  )
  await expect(page.locator('.complete-label')).toBeVisible()
  await expect(page.locator('.drawing-layer path')).toHaveCount(4)
})
test('documentation routes, internal links, metadata and responsive layouts work', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const width of [320, 390, 768, 1000, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ['/webmcp', '/hackathon']) {
      await page.goto(route)
      await expect(page).toHaveTitle(
        route === '/webmcp' ? /WebMCP tools, prompts/ : /Shared control with WebMCP/,
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://lens-webmcp.netlify.app${route}`,
      )
      const links = await page
        .locator('a[href]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')!))
      for (const href of new Set(links.filter((h) => h.startsWith('#'))))
        expect(await page.locator(`[id="${href.slice(1)}"]`).count(), href).toBe(1)
      for (const href of new Set(links.filter((h) => h.startsWith('/'))))
        expect((await request.get(href)).ok(), href).toBe(true)
      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const anchor = route === '/webmcp' ? 'Live inspector' : 'Video plan'
      await page.getByRole('link', { name: anchor, exact: true }).click()
      const target = route === '/webmcp' ? '#inspector' : '#video'
      const top = await page.locator(target).evaluate((node) => node.getBoundingClientRect().top)
      const headerBottom = await page
        .locator('.site-header')
        .evaluate((node) => node.getBoundingClientRect().bottom)
      expect(top).toBeGreaterThanOrEqual(headerBottom)
    }
  }
  await expect(page.locator('#video').getByText('[YOUTUBE_URL]', { exact: true })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Git repository', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/bclonan/webmcp-lense',
  )
  for (const file of [
    '/favicon.ico',
    '/favicon.svg',
    '/apple-touch-icon.png',
    '/og-image.png',
    '/icon-192.png',
    '/icon-512.png',
    '/site.webmanifest',
  ])
    expect((await request.get(file)).ok(), file).toBe(true)
  expect((await (await request.get('/favicon.ico')).body()).subarray(0, 4).toString('hex')).toBe(
    '00000100',
  )
  const png = await (await request.get('/og-image.png')).body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://lens-webmcp.netlify.app/og-image.png',
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )
  expect(errors).toEqual([])
})
test('comparison is isolated, chains are navigable, and legacy tools redirects', async ({
  page,
}) => {
  await nativeTools(page)
  await page.goto('/tools')
  await expect(page).toHaveURL(/\/webmcp$/)
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Next comparison step' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'House and sun complete, simulated' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => (window as any).__docsTools.goal_status.execute({})),
  ).toMatchObject({ data: { goal: null, authorized: false } })
  const choices = await page.locator('#workflow-guide option').count()
  expect(choices).toBeGreaterThanOrEqual(5)
  for (let i = 0; i < choices; i++) {
    await page.getByLabel('Choose a workflow').selectOption(String(i))
    const steps = page.locator('.docs-stepper button')
    await steps.last().click()
    await expect(steps.last()).toHaveAttribute('aria-current', 'step')
  }
})
test('configured video state renders a click-to-load YouTube player', async ({ page }) => {
  // Serve a test-only component through Vite. Production configuration remains a placeholder.
  await page.route('**/__video-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<div id="app"></div><script type="module">import {createApp,h} from "/node_modules/.vite/deps/vue.js"; import VideoPreview from "/src/components/VideoPreview.vue"; createApp({render:()=>h(VideoPreview,{url:"https://www.youtube.com/watch?v=abcdefghijk"})}).mount("#app")</script>',
    }),
  )
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Video fixture</p>' }),
  )
  await page.goto('/__video-fixture')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Load demo video' }).click()
  await expect(page.getByTitle('Lens demo video')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/abcdefghijk',
  )
})
