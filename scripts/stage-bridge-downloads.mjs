// Only release packages with matching manifests may enter the web deployment.
import { readdir, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const source = path.resolve(process.argv[2] || path.join(root, 'release/packages'))
const publicDir = path.join(root, 'apps/web/public')
const artifacts = []
for (const entry of await readdir(source)) {
  if (!/^(windows|macos|linux)-(x64|arm64)\.json$/.test(entry)) continue
  const metadata = JSON.parse(await readFile(path.join(source, entry), 'utf8'))
  if (
    !/^Lens-Bridge-[a-zA-Z0-9.\-]+\.(exe|dmg|deb)$/.test(metadata.fileName) ||
    metadata.protocolVersion !== 1
  )
    throw new Error('Invalid release manifest')
  const bytes = await readFile(path.join(source, metadata.fileName))
  if (
    createHash('sha256').update(bytes).digest('hex') !== metadata.sha256 ||
    bytes.length !== metadata.bytes
  )
    throw new Error(`Checksum mismatch: ${metadata.fileName}`)
  await mkdir(path.join(publicDir, 'downloads'), { recursive: true })
  await copyFile(
    path.join(source, metadata.fileName),
    path.join(publicDir, 'downloads', metadata.fileName),
  )
  artifacts.push({ ...metadata, url: `/downloads/${metadata.fileName}` })
}
if (
  artifacts.length !== 4 ||
  new Set(artifacts.map((a) => `${a.platform}-${a.architecture}`)).size !== 4 ||
  new Set(artifacts.map((a) => a.version)).size !== 1
)
  throw new Error('Expected four packages from one release version')
await writeFile(
  path.join(publicDir, 'bridge-releases.json'),
  JSON.stringify({ version: artifacts[0].version, protocolVersion: 1, artifacts }, null, 2) + '\n',
)
console.log(`Verified and staged ${artifacts.length} release packages`)
