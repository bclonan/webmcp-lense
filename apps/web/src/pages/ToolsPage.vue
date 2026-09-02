<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play, Check, X, Braces } from 'lucide-vue-next'
import { useLens } from '../app/context'
const lens = useLens(),
  selected = ref(lens.tools.definitions[0].name),
  input = ref('{}'),
  error = ref('')
const tool = computed(() => lens.tools.definitions.find((t) => t.name === selected.value)!)
const last = computed(() => lens.tools.invocations[selected.value])
function select(name: string) {
  selected.value = name
  input.value = JSON.stringify(tool.value.example, null, 2)
  error.value = ''
}
async function invoke() {
  try {
    await lens.tools.invoke(tool.value.name, JSON.parse(input.value))
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
</script>
<template>
  <section class="page-heading">
    <div class="eyebrow">WEBMCP / {{ lens.tools.status.mode }}</div>
    <h1>A screen agents can address.</h1>
    <p>
      {{ lens.tools.definitions.length }} tools. Shared application services. The same approval
      rules.<br />{{
        lens.tools.status.mode === 'Native WebMCP'
          ? 'Tools are registered with this browser.'
          : 'Native WebMCP is unavailable. The local inspector works in any supported browser.'
      }}
    </p>
    <p v-if="lens.tools.status.error" class="inline-error">{{ lens.tools.status.error }}</p>
  </section>
  <div class="tools-layout">
    <nav class="tool-list" aria-label="Registered tools">
      <button
        v-for="t in lens.tools.definitions"
        :key="t.name"
        :class="{ selected: t.name === selected }"
        @click="select(t.name)"
      >
        <Braces :size="13" />{{ t.name }}<span>{{ t.readOnly ? 'read' : 'act' }}</span>
      </button>
    </nav>
    <section class="tool-detail">
      <div class="panel-header">
        <h2>{{ tool.name }}</h2>
        <span class="small-tag">{{ tool.readOnly ? 'READ ONLY' : 'SHARED RUNTIME' }}</span>
      </div>
      <div class="tool-content">
        <p>{{ tool.description }}</p>
        <details>
          <summary>Strict input schema</summary>
          <pre>{{ JSON.stringify(lens.tools.schema(tool.name), null, 2) }}</pre>
        </details>
        <label for="tool-input">Example input</label
        ><textarea id="tool-input" v-model="input" rows="7" spellcheck="false" /><button
          class="button primary"
          @click="invoke"
        >
          <Play :size="13" /> Invoke tool
        </button>
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <div v-if="last" class="tool-output">
          <h3>
            <component :is="last.result.ok ? Check : X" :size="15" />{{
              last.result.ok ? 'Success' : 'Failed'
            }}
            <time>{{ new Date(last.at).toLocaleTimeString() }}</time>
          </h3>
          <details>
            <summary>Last invocation input</summary>
            <pre>{{ JSON.stringify(last.input, null, 2) }}</pre>
          </details>
          <pre aria-label="Last tool output">{{ JSON.stringify(last.result, null, 2) }}</pre>
        </div>
      </div>
    </section>
  </div>
  <p class="demo-footnote">
    Actuation requires the user to enable control in Workspace. Approvals remain in Workspace.
  </p>
</template>
