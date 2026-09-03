<script setup lang="ts">
import { ref, computed } from 'vue'
import { workflows } from '../content/workflows'
import CopyButton from './CopyButton.vue'
const selected = ref(0),
  step = ref(0)
const workflow = computed(() => workflows[selected.value]!)
</script>
<template>
  <div class="docs-workflows">
    <label for="workflow-guide">Choose a workflow</label>
    <select id="workflow-guide" v-model.number="selected" @change="step = 0">
      <option v-for="(w, i) in workflows" :key="w.id" :value="i">{{ w.name }}</option>
    </select>
    <h3>{{ workflow.goal }}</h3>
    <ol class="docs-stepper">
      <li v-for="(s, i) in workflow.steps" :key="i">
        <button :aria-current="step === i ? 'step' : undefined" @click="step = i">
          <span>{{ i + 1 }}</span
          >{{ s.tool }}
        </button>
      </li>
    </ol>
    <div class="docs-callout" aria-live="polite">
      <b>Step {{ step + 1 }}</b>
      <p>{{ workflow.steps[step]!.detail }}</p>
      <p>
        Data used: <code>{{ workflow.steps[step]!.uses.join(', ') || 'No earlier result' }}</code>
      </p>
    </div>
    <p><b>Human review.</b> {{ workflow.boundary }}</p>
    <p><b>Partial failure.</b> {{ workflow.failure }}</p>
    <details>
      <summary>Structured workflow</summary>
      <pre>{{
        JSON.stringify(
          { name: workflow.name, steps: workflow.steps.map(({ tool, uses }) => ({ tool, uses })) },
          null,
          2,
        )
      }}</pre>
    </details>
    <p class="docs-prompt">{{ workflow.prompt }}</p>
    <CopyButton :text="workflow.prompt" />
  </div>
</template>
