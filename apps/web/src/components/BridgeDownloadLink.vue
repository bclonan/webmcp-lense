<script setup lang="ts">
import { computed } from 'vue'
import { Download } from 'lucide-vue-next'
import { useBridgeDownloads } from '../bridge/downloads'
const { releases } = useBridgeDownloads()
const artifact = computed(() =>
  releases.value?.artifacts.find((a) => a.platform === 'windows' && a.architecture === 'x64'),
)
</script>
<template>
  <div v-if="artifact" class="bridge-download-link">
    <a class="text-link" :href="artifact.url" download>
      <Download :size="14" /> Download Windows bridge
    </a>
    <small
      >v{{ artifact.version }} · Windows x64 · {{ artifact.signed ? 'Signed' : 'Unsigned' }}
      {{ artifact.buildProfile === 'development' ? 'development preview' : 'preview' }}</small
    >
  </div>
</template>
<style scoped>
.bridge-download-link {
  display: grid;
  gap: 5px;
}
small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
