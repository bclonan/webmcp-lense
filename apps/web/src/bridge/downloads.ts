import { onMounted, ref } from 'vue'
import { z } from 'zod'

const releaseSchema = z.object({
  version: z.string(),
  protocolVersion: z.literal(1),
  artifacts: z.array(
    z.object({
      platform: z.enum(['windows', 'macos', 'linux']),
      architecture: z.enum(['x64', 'arm64']),
      version: z.string(),
      fileName: z.string().regex(/^Lens-Bridge-[a-zA-Z0-9.\-]+$/),
      url: z.string().regex(/^\/downloads\/Lens-Bridge-[a-zA-Z0-9.\-]+$/),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      buildDate: z.string(),
      buildProfile: z.enum(['release', 'development']).default('release'),
      bytes: z.number().positive(),
      signed: z.boolean(),
    }),
  ),
})
const releases = ref<z.infer<typeof releaseSchema> | null>(null)
const error = ref('')
const loading = ref(false)
async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/bridge-releases.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error()
    releases.value = releaseSchema.parse(await response.json())
  } catch {
    error.value = 'Downloads could not be loaded. Try again.'
  } finally {
    loading.value = false
  }
}
export function useBridgeDownloads() {
  onMounted(() => {
    if (!releases.value) void load()
  })
  return { releases, error, loading, reload: load }
}
