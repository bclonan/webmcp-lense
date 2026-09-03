<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
const available = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let pending = false
let controller: AbortController | undefined
async function check() {
  if (document.visibilityState === 'hidden' || pending || available.value) return
  pending = true
  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), 5000)
  try {
    const response = await fetch('/app-version.json', {
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return
    const version = await response.json()
    available.value =
      typeof version.buildId === 'string' && version.buildId !== import.meta.env.VITE_LENS_BUILD_ID
  } catch {
    /* An offline update check must not interrupt a desktop session. */
  } finally {
    clearTimeout(timeout)
    pending = false
  }
}
function reload() {
  window.location.reload()
}
onMounted(() => {
  void check()
  timer = setInterval(() => void check(), 60000)
  document.addEventListener('visibilitychange', check)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  controller?.abort()
  document.removeEventListener('visibilitychange', check)
})
</script>
<template>
  <div v-if="available" class="connection-banner" role="status">
    <span
      >A new version of Lens is available. Reload to update. This ends screen sharing and
      pairing.</span
    >
    <button class="button light" @click="reload">Reload to update</button>
  </div>
</template>
