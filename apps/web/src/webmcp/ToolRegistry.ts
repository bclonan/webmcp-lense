import { reactive } from 'vue'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
export interface ToolDefinition {
  name: string
  description: string
  schema: z.ZodTypeAny
  output: z.ZodTypeAny
  example: Record<string, unknown>
  readOnly?: boolean
  handler(input: any, signal?: AbortSignal): Promise<unknown> | unknown
}
export type ToolResult =
  { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } }
export class ToolRegistry {
  readonly invocations = reactive<
    Record<string, { at: number; input: unknown; result: ToolResult }>
  >({})
  readonly status = reactive({ mode: 'Local tools' as string, error: '' })
  constructor(readonly definitions: ToolDefinition[]) {
    if (new Set(definitions.map((t) => t.name)).size !== definitions.length)
      throw new Error('Duplicate tool names.')
  }
  schema(name: string) {
    const tool = this.definitions.find((t) => t.name === name)
    if (!tool) throw new Error('Unknown tool')
    const schema = zodToJsonSchema(tool.schema, { $refStrategy: 'none' })
    return name === 'desktop_click'
      ? { ...schema, oneOf: [{ required: ['targetId'] }, { required: ['point'] }] }
      : schema
  }
  async invoke(name: string, input: unknown, signal?: AbortSignal): Promise<ToolResult> {
    let result: ToolResult
    try {
      signal?.throwIfAborted()
      const tool = this.definitions.find((t) => t.name === name)
      if (!tool) throw new Error('Unknown tool. Refresh tool discovery.')
      const parsed = tool.schema.parse(input)
      const output = await tool.handler(parsed, signal)
      result = { ok: true, data: tool.output.parse(output) }
    } catch (error) {
      result = {
        ok: false,
        error: {
          code:
            error instanceof z.ZodError
              ? 'VALIDATION_ERROR'
              : signal?.aborted
                ? 'CANCELLED'
                : 'ACTION_ERROR',
          message: error instanceof Error ? error.message.slice(0, 2000) : String(error),
        },
      }
    }
    this.invocations[name] = { at: Date.now(), input, result }
    return result
  }
}
