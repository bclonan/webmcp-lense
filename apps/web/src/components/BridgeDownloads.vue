<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { z } from 'zod'
const origin = window.location.origin
const platform = ref(
  /Mac/i.test(navigator.platform)
    ? 'macos'
    : /Linux/i.test(navigator.platform)
      ? 'linux'
      : 'windows',
)
const architecture = ref('arm64')
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
      bytes: z.number().positive(),
      signed: z.boolean(),
    }),
  ),
})
const releases = ref<z.infer<typeof releaseSchema> | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    const response = await fetch('/bridge-releases.json', { cache: 'no-store' })
    if (!response.ok) throw new Error()
    releases.value = releaseSchema.parse(await response.json())
  } catch {
    error.value = 'Downloads could not be loaded. Refresh this page to try again.'
  }
})
const selected = computed(() =>
  releases.value?.artifacts.find(
    (a) =>
      a.platform === platform.value &&
      a.architecture === (platform.value === 'macos' ? architecture.value : 'x64'),
  ),
)
</script>
<template>
  <section class="bridge-downloads">
    <h3>Get the optional desktop companion</h3>
    <p>
      Browser demos and WebMCP tools need no installation. Native mouse and keyboard control needs
      Lens Bridge.
    </p>
    <div class="input-row">
      <label
        >Your computer
        <select v-model="platform" aria-label="Download operating system">
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
          <option value="linux">Linux X11</option>
        </select>
      </label>
      <label v-if="platform === 'macos'"
        >Mac chip
        <select v-model="architecture" aria-label="Mac chip">
          <option value="arm64">Apple silicon</option>
          <option value="x64">Intel</option>
        </select>
      </label>
    </div>
    <template v-if="selected">
      <a class="button primary" :href="selected.url" download
        >Download for
        {{ platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Linux' }}</a
      >
      <p class="control-note">
        Version {{ selected.version }} · {{ selected.architecture }} ·
        {{ (selected.bytes / 1048576).toFixed(1) }} MB ·
        {{ selected.signed ? 'Signed' : 'Unsigned preview' }}
      </p>
      <details>
        <summary>Verify this download</summary>
        <p>Built {{ selected.buildDate }}. SHA-256</p>
        <code class="checksum">{{ selected.sha256 }}</code>
      </details>
    </template>
    <p v-else role="status">
      {{ error || 'A verified download for this platform has not been published yet.' }}
    </p>
    <ol class="setup-instructions">
      <li v-if="platform === 'windows'">
        Download the app and open Lens Bridge. No installer or terminal is needed.
      </li>
      <li v-else-if="platform === 'macos'">
        Open the disk image, drag Lens Bridge into Applications, then open it. Allow Lens Bridge in
        System Settings, Privacy &amp; Security, Accessibility. Allow Screen Recording for your
        browser.
      </li>
      <li v-else>
        Open the Debian package with your software installer, then launch Lens Bridge from
        Applications. Ubuntu 24.04 or newer with an X11 session is required. Wayland desktop input
        is unavailable.
      </li>
      <li>
        Check that Allowed website matches <code>{{ origin }}</code
        >. Keep the companion window open.
      </li>
      <li>
        Click Copy code in Lens Bridge. Enter it below and click Pair bridge. Codes expire in five
        minutes.
      </li>
    </ol>
    <p v-if="selected && !selected.signed" class="control-note">
      This preview has no publisher signature{{
        platform === 'macos' ? ' or Apple notarization' : ''
      }}. Your operating system may block it. Follow your device's security policy.
    </p>
  </section>
</template>
<style scoped>
.bridge-downloads {
  border: 1px solid var(--line, #d9ddd7);
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
}
.bridge-downloads select {
  display: block;
  margin: 4px 0 12px;
}
.checksum {
  overflow-wrap: anywhere;
}
</style>
