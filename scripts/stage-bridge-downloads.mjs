// Downloads require matching manifests. A Windows development preview is explicit.
import { readdir, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const preview = process.argv.includes('--preview')
const source = path.resolve(
  process.argv.slice(2).find((a) => !a.startsWith('--')) ||
    path.join(root, preview ? 'release/preview-packages' : 'release/packages'),
)
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
  if (
    preview
      ? metadata.platform !== 'windows' ||
        metadata.architecture !== 'x64' ||
        metadata.buildProfile !== 'development'
      : metadata.buildProfile === 'development'
  )
    throw new Error('Build profile does not match the requested staging mode')
  const bytes = await readFile(path.join(source, metadata.fileName))
  if (
    createHash('sha256').update(bytes).digest('hex') !== metadata.sha256 ||
    bytes.length !== metadata.bytes
  )
    throw new Error(`Checksum mismatch: ${metadata.fileName}`)
  artifacts.push({ ...metadata, url: `/downloads/${metadata.fileName}` })
}
if (
  artifacts.length !== (preview ? 1 : 4) ||
  new Set(artifacts.map((a) => `${a.platform}-${a.architecture}`)).size !== artifacts.length ||
  new Set(artifacts.map((a) => a.version)).size !== 1
)
  throw new Error(
    preview
      ? 'Expected one Windows development preview'
      : 'Expected four packages from one release version',
  )
await mkdir(path.join(publicDir, 'downloads'), { recursive: true })
for (const artifact of artifacts)
  await copyFile(
    path.join(source, artifact.fileName),
    path.join(publicDir, 'downloads', artifact.fileName),
  )
await writeFile(
  path.join(publicDir, 'bridge-releases.json'),
  JSON.stringify({ version: artifacts[0].version, protocolVersion: 1, artifacts }, null, 2) + '\n',
)
console.log(
  `Verified and staged ${artifacts.length} ${preview ? 'development preview' : 'release'} packages`,
)
