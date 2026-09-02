<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Monitor } from 'lucide-vue-next'
import { useLens } from '../app/context'
const lens = useLens(),
  video = ref<HTMLVideoElement>()
function attach() {
  if (video.value) {
    video.value.srcObject = lens.capture.getStream()
    void video.value.play().catch(() => {})
  }
}
onMounted(attach)
watch(() => lens.screen.sharing, attach)
onBeforeUnmount(() => {
  if (video.value) video.value.srcObject = null
})
</script>
<template>
  <div class="live-screen">
    <video
      v-if="lens.screen.sharing"
      ref="video"
      autoplay
      muted
      playsinline
      aria-label="Live shared screen"
    />
    <div v-else class="share-empty">
      <Monitor :size="32" />
      <h3>Your screen belongs here.</h3>
      <p>Share a screen or window using the browser permission dialog.</p>
      <button
        class="button primary"
        @click="lens.shareScreen().catch((e) => (lens.session.error = String(e)))"
      >
        Share Screen
      </button>
    </div>
  </div>
</template>
