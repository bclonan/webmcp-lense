<script setup lang="ts">
import { ref } from 'vue'
import type { RuntimeEvent } from '@lens/protocol'
import { useLens } from '../app/context'
import EventTimeline from '../components/EventTimeline.vue'
const lens = useLens(),
  saved = ref(''),
  historyId = ref(''),
  historyEvents = ref<RuntimeEvent[]>([])
async function save() {
  try {
    await lens.saveSettings()
    saved.value = 'Preferences saved.'
  } catch {
    saved.value = 'Local storage is unavailable.'
  }
}
async function history() {
  try {
    historyEvents.value = await lens.repository.events(historyId.value)
  } catch {
    saved.value = 'Could not read session history.'
  }
}
</script>
<template>
  <section class="page-heading">
    <div class="eyebrow">LOCAL PREFERENCES</div>
    <h1>Make room for your pace.</h1>
    <p>Adjust observation sensitivity and the time between actions.</p>
  </section>
  <section class="settings-panel">
    <h2>Observation and playback</h2>
    <label
      >Visual change threshold <output>{{ lens.settings.changeThreshold }}</output
      ><input
        type="range"
        v-model.number="lens.settings.changeThreshold"
        min="0.005"
        max="0.2"
        step="0.005"
    /></label>
    <p>
      Lower values detect smaller changes. Live frames are sampled locally at most twice per second.
    </p>
    <label
      >Time between steps <output>{{ lens.settings.stepDelay }} ms</output
      ><input
        type="range"
        v-model.number="lens.settings.stepDelay"
        min="0"
        max="1500"
        step="50" /></label
    ><button class="button primary" @click="save">Save preferences</button
    ><span class="settings-saved" role="status">{{ saved }}</span>
    <p>
      Raw screenshots and video are never persisted. Pairing credentials stay in memory. Reloading
      never restores desktop control.
    </p>
    <p>
      Event history includes typed text and semantic observations. Use fictional data for
      demonstrations. The demo and its fonts are served locally; no model requests are made.
    </p>
  </section>
  <section class="history-panel">
    <h2>Past sessions</h2>
    <p class="history-note">
      Read a saved timeline. Viewing history never resumes desktop control.
    </p>
    <label for="session-history" class="sr-only">Saved session</label
    ><select id="session-history" v-model="historyId" @change="history">
      <option value="">Choose a saved session</option>
      <option v-for="s in lens.session.history" :key="s.id" :value="s.id">
        {{ new Date(s.createdAt).toLocaleString() }} · {{ s.mode }} · {{ s.id.slice(-6) }}
      </option></select
    ><EventTimeline v-if="historyId" :events="historyEvents" />
  </section>
</template>
