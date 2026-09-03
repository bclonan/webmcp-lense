<script setup lang="ts">
import { computed, ref } from 'vue'
import { youtubeEmbed } from '../content/video'
const props = defineProps<{ url: string }>()
const embed = computed(() => youtubeEmbed(props.url))
const loaded = ref(false)
</script>
<template>
  <div class="docs-video">
    <iframe
      v-if="embed && loaded"
      :src="embed"
      title="Lens demo video"
      loading="lazy"
      allow="encrypted-media; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
    <div v-else-if="embed" class="docs-video-placeholder">
      <h3>Watch the Lens demo</h3>
      <p>The player loads from YouTube only when you choose to watch.</p>
      <button class="button primary" @click="loaded = true">Load demo video</button>
    </div>
    <div v-else class="docs-video-placeholder">
      <span class="eyebrow">DEMO VIDEO / NOT PUBLISHED</span>
      <h3>A short tour of shared control.</h3>
      <p>
        The public YouTube demo will appear here after recording and upload. The complete 2:50
        narration is below.
      </p>
      <code>[YOUTUBE_URL]</code>
    </div>
  </div>
</template>
