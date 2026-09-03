import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const root = new URL('../', import.meta.url)
const project = JSON.parse(
  await readFile(new URL('apps/web/src/content/project.json', root), 'utf8'),
)
const origin = process.argv[2] || project.liveUrl
const dist = new URL('apps/web/dist/', root)
const index = await readFile(new URL('index.html', dist), 'utf8')
const build = JSON.parse(await readFile(new URL('app-version.json', dist), 'utf8'))
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function get(path) {
  const response = await fetch(new URL(path, origin), { cache: 'no-store' })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response
}
const deployed = await (await get('/app-version.json')).json()
if (deployed.buildId !== build.buildId)
  throw new Error('Production build marker differs from the local build.')
const entry = index.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1]
if (!entry) throw new Error('Built JavaScript entry was not found.')
for (const path of ['/session', '/webmcp', '/hackathon', '/tools']) {
  const html = await (await get(path)).text()
  if (!html.includes(entry) || !html.includes('summary_large_image'))
    throw new Error(`${path}: wrong bundle or missing metadata`)
  console.log(`${path}: HTTP 200, current bundle and metadata`)
}
const assets = new Set([
  ...Array.from(
    index.matchAll(
      /(?:src|href)="(\/(?:assets\/[^\"]+|favicon[^\"]+|apple-touch-icon.png|site.webmanifest))"/g,
    ),
    (m) => m[1],
  ),
  '/og-image.png',
  '/icon-192.png',
  '/icon-512.png',
  '/asset-licenses.txt',
])
const js = await readFile(new URL(entry.slice(1), dist), 'utf8')
// Font URLs are emitted into the stylesheet; verify each referenced local font too.
for (const css of [...assets].filter((path) => path.endsWith('.css'))) {
  const text = await readFile(new URL(css.slice(1), dist), 'utf8')
  for (const match of text.matchAll(/url\((?:["'])?(\/assets\/[^)'" ]+)/g)) assets.add(match[1])
}
for (const text of ['A shared workspace.', 'Your screen.', 'Live tool inspector'])
  if (!js.includes(text)) throw new Error(`Current documentation content missing: ${text}`)
for (const path of assets) {
  const bytes = Buffer.from(await (await get(path)).arrayBuffer())
  const local = await readFile(new URL(path.slice(1), dist))
  if (digest(bytes) !== digest(local)) throw new Error(`${path}: content differs from the build`)
  console.log(`${path}: ${bytes.length} bytes, SHA-256 matches`)
}
console.log(
  `Verified build ${build.buildId}. Browser checks must verify rendered routes and WebMCP separately.`,
)
