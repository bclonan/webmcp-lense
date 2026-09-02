<script setup lang="ts">
import { ref } from 'vue'
import { Circle, Square, Plus } from 'lucide-vue-next'
import { useLens } from '../app/context'
import CapabilityCartridge from './CapabilityCartridge.vue'
const lens = useLens(),
  name = ref('My recorded workflow'),
  note = ref(''),
  expanded = ref(false),
  error = ref(''),
  importing = ref(false),
  importJson = ref('')
async function toggle() {
  try {
    if (lens.session.recording) await lens.stopRecording(name.value)
    else lens.startRecording()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
function annotate() {
  if (!note.value.trim()) return
  lens.event('workflow.annotated', note.value.slice(0, 1000), { source: 'human note' })
  note.value = ''
}
async function importCartridge() {
  try {
    await lens.saveCartridge(JSON.parse(importJson.value))
    importing.value = false
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
</script>
<template>
  <section class="workflow-panel">
    <div class="panel-header">
      <h2>
        Teach a workflow <span>{{ lens.session.cartridges.length }} cartridges</span>
      </h2>
      <button class="text-link" @click="expanded = !expanded">
        {{ expanded ? 'Hide workflows' : 'Show workflows' }}
      </button>
    </div>
    <div class="recording-bar">
      <button
        class="button light"
        :disabled="lens.session.recording && lens.runtimeState.busy"
        @click="toggle"
      >
        <component
          :is="lens.session.recording ? Square : Circle"
          :size="12"
          :fill="lens.session.recording ? '#a35945' : 'none'"
        />{{ lens.session.recording ? 'Stop recording' : 'Record Workflow' }}</button
      ><input v-model="name" aria-label="Workflow name" maxlength="100" /><span
        >Records actions through Lens. No global keyboard recording.</span
      >
    </div>
    <div v-if="lens.session.recording" class="annotation-bar">
      <input
        v-model="note"
        aria-label="Human step annotation"
        placeholder="Add a note about a manual step"
        maxlength="1000"
      /><button class="button light" @click="annotate">Add note</button>
    </div>
    <div v-if="expanded" class="cartridge-grid">
      <CapabilityCartridge v-for="c in lens.session.cartridges" :key="c.id" :cartridge="c" />
      <div>
        <button class="button light" @click="importing = !importing">
          <Plus :size="13" /> Import cartridge JSON
        </button>
        <div v-if="importing" class="cartridge-editor">
          <textarea v-model="importJson" aria-label="Import cartridge JSON" rows="12" /><button
            class="button primary"
            @click="importCartridge"
          >
            Validate and import
          </button>
        </div>
      </div>
    </div>
    <p v-if="error" class="notice warning" role="alert">{{ error }}</p>
  </section>
</template>
