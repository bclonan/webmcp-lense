<script setup lang="ts">
import { ref } from 'vue'
const props = defineProps<{ text: string; label?: string }>()
const feedback = ref('')
async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
    feedback.value = 'Copied.'
  } catch {
    feedback.value = 'Copy unavailable. Select the text and copy it manually.'
  }
}
</script>
<template>
  <span class="copy-control"
    ><button class="text-link" @click="copy">{{ label ?? 'Copy prompt' }}</button
    ><small role="status">{{ feedback }}</small></span
  >
</template>
