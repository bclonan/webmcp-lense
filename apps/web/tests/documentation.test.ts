import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Ajv from 'ajv'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { LensService } from '../src/app/LensService'
import { ToolRegistry } from '../src/webmcp/ToolRegistry'
import { documentationModel, runDocumentationTool } from '../src/content/toolDocs'
import { workflows, promptLibrary } from '../src/content/workflows'
import script from '../src/content/demo-video-script.json'
import { youtubeEmbed } from '../src/content/video'
beforeEach(() => setActivePinia(createPinia()))
describe('Registry-derived documentation', () => {
  it('documents every tool once and validates all argument and output examples', () => {
    const registry = new LensService().tools
    const docs = documentationModel(registry)
    expect(docs.map((t) => t.name)).toEqual(registry.definitions.map((t) => t.name))
    const ajv = new Ajv({ strict: false })
    for (const doc of docs) {
      const validate = ajv.compile(doc.schema)
      expect(validate(doc.arguments), `${doc.name}: ${JSON.stringify(validate.errors)}`).toBe(true)
      expect(doc.exampleValid, doc.name).toBe(true)
      expect(doc.resultValid, doc.name).toBe(true)
      expect(doc.prompt).toContain(doc.name)
      expect(doc.recovery.length).toBeGreaterThan(20)
      expect(doc.source).toBe('apps/web/src/webmcp/tools.ts')
    }
  })
  it('includes a newly registered tool and generates a prompt without an editorial entry', () => {
    const registry = new ToolRegistry([
      {
        name: 'inspect_example',
        description: 'Read example status.',
        schema: z.object({ query: z.string() }).strict(),
        output: z.unknown(),
        example: { query: 'current' },
        readOnly: true,
        handler: () => ({}),
      },
    ])
    const [doc] = documentationModel(registry)
    expect(doc.name).toBe('inspect_example')
    expect(doc.prompt).toContain('current')
    expect(doc.classification).toBe('Read-only')
  })
  it('never executes a mutating tool from documentation, even if called directly', async () => {
    const registry = new LensService().tools
    const invoke = vi.spyOn(registry, 'invoke')
    for (const tool of registry.definitions.filter((t) => !t.readOnly))
      await expect(runDocumentationTool(registry, tool.name, tool.example)).rejects.toThrow(
        'does not execute changes',
      )
    expect(invoke).not.toHaveBeenCalled()
    expect((await runDocumentationTool(registry, 'goal_status', {})).ok).toBe(true)
  })
  it('references only registered tools in prompts, chains and the narration', () => {
    const docs = documentationModel(new LensService().tools)
    const names = new Set(docs.map((t) => t.name))
    expect(workflows.length).toBeGreaterThanOrEqual(5)
    expect(new Set(promptLibrary.map((p) => p.group)).size).toBe(10)
    for (const name of [
      ...workflows.flatMap((w) => w.steps.map((s) => s.tool)),
      ...promptLibrary.flatMap((p) => p.tools),
      ...script.flatMap((s) => s.tools),
    ])
      expect(names.has(name), name).toBe(true)
    for (const workflow of workflows)
      for (const [index, step] of workflow.steps.entries())
        for (const dependency of step.uses) {
          const [, source, ...path] = dependency.split('.')
          expect(Number(source)).toBeLessThan(index)
          const result = docs.find(
            (doc) => doc.name === workflow.steps[Number(source)].tool,
          )!.result
          const value = path.reduce((current: any, key) => current?.[key], result)
          expect(value, `${workflow.id}: ${dependency}`).not.toBeUndefined()
        }
    const words = script
      .map((s) => s.narration)
      .join(' ')
      .split(/\s+/).length
    expect(words / (170 / 60)).toBeGreaterThanOrEqual(130)
    expect(words / (170 / 60)).toBeLessThanOrEqual(150)
    const markdown = readFileSync(
      new URL('../../../docs/demo-video-script.md', import.meta.url),
      'utf8',
    )
    for (const s of script) expect(markdown).toContain(s.narration)
  })
  it('allows configured YouTube videos and rejects placeholders or unrelated URLs', () => {
    expect(youtubeEmbed('[YOUTUBE_URL]')).toBeNull()
    expect(youtubeEmbed('https://www.youtube.com/watch?v=abcdefghijk')).toBe(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    )
    expect(youtubeEmbed('https://youtu.be/abcdefghijk')).toBe(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    )
    for (const url of [
      'javascript:alert(1)',
      'https://youtube.com.evil.test/watch?v=abcdefghijk',
      'https://evil.test/embed/abcdefghijk',
      'http://youtu.be/abcdefghijk',
      'https://user@youtu.be/abcdefghijk',
    ])
      expect(youtubeEmbed(url)).toBeNull()
  })
})
