import { readFile, writeFile, mkdir, copyFile, chmod, symlink, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const platform = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform]
const architecture = process.arch
if (!platform || !['x64', 'arm64'].includes(architecture))
  throw new Error('Unsupported package platform')
const cargo = await readFile(path.join(root, 'apps/bridge/Cargo.toml'), 'utf8')
const version = cargo.match(/^version = "([^"]+)"/m)[1]
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const buildDate = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const staging = path.join(root, 'release', `${platform}-${architecture}`)
const out = path.join(root, 'release', 'packages')
await mkdir(staging, { recursive: true })
await mkdir(out, { recursive: true })
const binary = path.join(
  root,
  'apps/bridge/target/release',
  platform === 'windows' ? 'lens-bridge.exe' : 'lens-bridge',
)
const base = `Lens-Bridge-${version}-${platform}-${architecture}`
let fileName
if (platform === 'windows') {
  fileName = `${base}.exe`
  await copyFile(binary, path.join(out, fileName))
} else if (platform === 'macos') {
  const app = path.join(staging, 'Lens Bridge.app', 'Contents')
  await mkdir(path.join(app, 'MacOS'), { recursive: true })
  await copyFile(binary, path.join(app, 'MacOS', 'lens-bridge'))
  await chmod(path.join(app, 'MacOS', 'lens-bridge'), 0o755)
  await writeFile(
    path.join(app, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>lens-bridge</string><key>CFBundleIdentifier</key><string>app.lenswebmcp.bridge</string><key>CFBundleName</key><string>Lens Bridge</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleVersion</key><string>${version}</string><key>LSMinimumSystemVersion</key><string>12.0</string><key>NSHighResolutionCapable</key><true/><key>NSAppleEventsUsageDescription</key><string>Lens Bridge sends only reviewed mouse and keyboard actions.</string></dict></plist>`,
  )
  await symlink('/Applications', path.join(staging, 'Applications')).catch((e) => {
    if (e.code !== 'EEXIST') throw e
  })
  fileName = `${base}.dmg`
  execFileSync(
    'hdiutil',
    [
      'create',
      '-volname',
      'Lens Bridge',
      '-srcfolder',
      staging,
      '-ov',
      '-format',
      'UDZO',
      path.join(out, fileName),
    ],
    { stdio: 'inherit' },
  )
} else {
  const deb = path.join(staging, 'deb')
  await mkdir(path.join(deb, 'usr/bin'), { recursive: true })
  await mkdir(path.join(deb, 'usr/share/applications'), { recursive: true })
  await mkdir(path.join(deb, 'DEBIAN'), { recursive: true })
  await copyFile(binary, path.join(deb, 'usr/bin/lens-bridge'))
  await chmod(path.join(deb, 'usr/bin/lens-bridge'), 0o755)
  await writeFile(
    path.join(deb, 'usr/share/applications/lens-bridge.desktop'),
    '[Desktop Entry]\nType=Application\nName=Lens Bridge\nExec=/usr/bin/lens-bridge\nTerminal=false\nCategories=Utility;\nComment=Pair Lens with your X11 desktop\n',
  )
  await writeFile(
    path.join(deb, 'DEBIAN/control'),
    `Package: lens-bridge\nVersion: ${version}\nArchitecture: ${architecture === 'x64' ? 'amd64' : 'arm64'}\nMaintainer: Lens project\nDepends: libc6 (>= 2.39), libxkbcommon0, libx11-6, libxi6, libxcursor1, libxrandr2, libgl1, libwayland-client0, libwayland-cursor0\nDescription: Optional Lens desktop companion for X11\n Native mouse and keyboard actions require visible browser pairing.\n`,
  )
  fileName = `${base}.deb`
  execFileSync('dpkg-deb', ['--root-owner-group', '--build', deb, path.join(out, fileName)], {
    stdio: 'inherit',
  })
}
const content = await readFile(path.join(out, fileName))
const metadata = {
  version,
  protocolVersion: 1,
  platform,
  architecture,
  fileName,
  sha256: createHash('sha256').update(content).digest('hex'),
  bytes: (await stat(path.join(out, fileName))).size,
  buildDate,
  commit,
  signed: false,
}
await writeFile(
  path.join(out, `${platform}-${architecture}.json`),
  JSON.stringify(metadata, null, 2) + '\n',
)
console.log(JSON.stringify(metadata, null, 2))
