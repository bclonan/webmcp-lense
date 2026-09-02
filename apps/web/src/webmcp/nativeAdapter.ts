import type { ToolRegistry } from './ToolRegistry'
interface ModelContext {
  registerTool(
    tool: {
      name: string
      description: string
      inputSchema: object
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }
      execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>
    },
    options: { signal: AbortSignal },
  ): Promise<void> | void
}
export async function registerNativeTools(
  registry: ToolRegistry,
  host: { modelContext?: ModelContext } = document as { modelContext?: ModelContext },
): Promise<() => void> {
  const context = host.modelContext
  if (typeof context?.registerTool !== 'function') {
    registry.status.mode = 'Local tools'
    return () => {}
  }
  const controller = new AbortController()
  try {
    for (const tool of registry.definitions)
      await context.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: registry.schema(tool.name),
          annotations: { readOnlyHint: !!tool.readOnly, untrustedContentHint: true },
          execute: (input, options) => registry.invoke(tool.name, input, options?.signal),
        },
        { signal: controller.signal },
      )
    registry.status.mode = 'Native WebMCP'
  } catch (error) {
    controller.abort()
    registry.status.mode = 'Local tools'
    registry.status.error = `Native registration failed: ${String(error)}`
  }
  return () => controller.abort()
}
