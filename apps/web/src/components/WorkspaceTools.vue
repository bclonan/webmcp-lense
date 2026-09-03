<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLens } from '../app/context'
const lens = useLens()
const selected = ref('')
const input = ref('{}')
const error = ref('')
const invoking = ref(false)
const tool = computed(() => lens.tools.definitions.find((t) => t.name === selected.value))
const last = computed(() => lens.tools.invocations[selected.value])
function select(name: string) {
  selected.value = selected.value === name ? '' : name
  input.value = JSON.stringify(tool.value?.example ?? {}, null, 2)
  error.value = ''
}
async function invoke() {
  if (!tool.value || invoking.value) return
  invoking.value = true
  try {
    await lens.tools.invoke(tool.value.name, JSON.parse(input.value))
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    invoking.value = false
  }
}
</script>
<template>
  <section id="workspace-tools" class="workspace-tools" aria-label="WebMCP tools">
    <div class="panel-header">
      <h2>
        WebMCP tools <span>{{ lens.tools.definitions.length }}</span>
      </h2>
      <span class="small-tag">{{
        lens.tools.status.mode === 'Native WebMCP' ? 'CONNECTED' : 'LOCAL'
      }}</span>
    </div>
    <p class="tools-status" role="status">
      {{
        lens.tools.status.error ||
        (lens.tools.status.mode === 'Native WebMCP'
          ? 'This browser can call these tools.'
          : 'WebMCP is unavailable in this browser. Try the tools here.')
      }}
    </p>
    <div class="workspace-tool-list" aria-label="Available WebMCP tools">
      <button
        v-for="item in lens.tools.definitions"
        :key="item.name"
        :class="{ selected: item.name === selected }"
        :aria-expanded="item.name === selected"
        :disabled="invoking"
        @click="select(item.name)"
      >
        <span>{{ item.name }}</span
        ><small>{{ item.readOnly ? 'read' : 'act' }}</small>
      </button>
    </div>
    <div v-if="tool" class="workspace-tool-detail">
      <p>{{ tool.description }}</p>
      <label for="workspace-tool-input">Tool input</label>
      <textarea
        id="workspace-tool-input"
        v-model="input"
        rows="3"
        spellcheck="false"
        :disabled="invoking"
      />
      <button
        class="button light"
        :disabled="invoking || (!tool.readOnly && lens.runtimeState.busy)"
        @click="invoke"
      >
        {{ invoking ? 'Calling tool…' : 'Call tool' }}
      </button>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <pre v-if="last" aria-label="Workspace tool result">{{
        JSON.stringify(last.result, null, 2)
      }}</pre>
    </div>
  </section>
</template>
