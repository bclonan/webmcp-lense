import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const base = new URL(process.argv[2] || 'https://lens-webmcp.netlify.app')
const expected = JSON.parse(
  await readFile(path.join(root, 'apps/web/public/bridge-releases.json'), 'utf8'),
)
const preview =
  expected.artifacts.length === 1 &&
  expected.artifacts[0].platform === 'windows' &&
  expected.artifacts[0].buildProfile === 'development'
if (!preview && expected.artifacts.length !== 4)
  throw new Error('No complete release is staged. Do not advertise unavailable downloads.')
const response = await fetch(new URL('/bridge-releases.json', base))
if (!response.ok) throw new Error(`Manifest returned ${response.status}`)
const hosted = await response.json()
if (JSON.stringify(hosted) !== JSON.stringify(expected))
  throw new Error('Hosted release manifest differs from staged manifest')
for (const artifact of expected.artifacts) {
  const url = new URL(artifact.url, base)
  if (
    url.origin !== base.origin ||
    !/^\/downloads\/Lens-Bridge-[a-zA-Z0-9.\-]+$/.test(url.pathname)
  )
    throw new Error('Invalid download path')
  const result = await fetch(url)
  if (!result.ok) throw new Error(`${artifact.fileName}: HTTP ${result.status}`)
  const bytes = Buffer.from(await result.arrayBuffer())
  if (
    bytes.length !== artifact.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
  )
    throw new Error(`${artifact.fileName}: checksum mismatch`)
  await mkdir(path.join(root, 'release/downloaded'), { recursive: true })
  await writeFile(path.join(root, 'release/downloaded', artifact.fileName), bytes)
  console.log(`Verified ${url.href} ${artifact.sha256}`)
}
