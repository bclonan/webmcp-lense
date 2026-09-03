import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const segments = JSON.parse(
  await readFile(new URL('apps/web/src/content/demo-video-script.json', root), 'utf8'),
)
const words = segments
  .map((s) => s.narration)
  .join(' ')
  .split(/\s+/).length
const output =
  `# Lens demo video script\n\nTarget runtime: 2:50. ${words} spoken words, about ${Math.round(words / (170 / 60))} words per minute. Use the fixture desktop, fictional data and an agent connected to the current Lens page. Do not cut the primary workflow.\n\nGenerated from apps/web/src/content/demo-video-script.json. Edit that file, then run node scripts/generate-demo-script.mjs.\n\n` +
  segments
    .map(
      (s) =>
        `## ${s.time} | ${s.title}\n\nScreen action: ${s.action}\n\nNarration:\n\n> ${s.narration}\n\nWebMCP tools: ${s.tools.map((t) => '`' + t + '`').join(', ') || 'None in this segment.'}\n\nExpected visible result: ${s.result}\n`,
    )
    .join('\n')
await writeFile(new URL('docs/demo-video-script.md', root), output)
console.log(`Generated video script: ${words} words`)
