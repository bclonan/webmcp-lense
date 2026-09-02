<script setup lang="ts">
import { ref } from 'vue'
import { Check, X, Play, ShieldCheck } from 'lucide-vue-next'
import { useLens } from '../app/context'
import { runEvaluations, type EvalResult } from '../runtime/evals'
const lens = useLens(),
  results = ref<EvalResult[]>([]),
  running = ref(false)
async function run() {
  running.value = true
  results.value = []
  try {
    await runEvaluations(lens.tools, (r) => results.value.push(r))
  } finally {
    running.value = false
  }
}
</script>
<template>
  <section class="page-heading">
    <div class="eyebrow">DETERMINISTIC EVALUATIONS</div>
    <h1>Trust comes from checking.</h1>
    <p>
      Exercise the runtime, policy and tools with isolated fixtures.<br />These checks never send
      input to your real desktop.
    </p>
  </section>
  <section class="eval-panel">
    <div class="panel-header">
      <h2>
        <ShieldCheck :size="17" />
        {{
          results.length
            ? `${results.filter((r) => r.status === 'PASS').length} of ${results.length} checks passed`
            : '12 checks. Real assertions.'
        }}
      </h2>
      <button class="button primary" :disabled="running || lens.runtimeState.busy" @click="run">
        <Play :size="13" />{{ running ? 'Running checks' : 'Run evaluations' }}
      </button>
    </div>
    <div v-if="!results.length" class="eval-empty">
      <ShieldCheck :size="32" />
      <p>Verify control before you trust it.</p>
      <span>Tool registration · Policy · Approval · Cancellation · Completion</span>
    </div>
    <div v-for="r in results" :key="r.name" class="eval-row">
      <component :is="r.status === 'PASS' ? Check : X" :size="17" /><span
        >{{ r.name }}<small>{{ r.detail }}</small></span
      ><b :class="{ fail: r.status === 'FAIL' }">{{ r.status }}</b
      ><time>{{ r.durationMs }} ms</time>
    </div>
  </section>
  <p class="demo-footnote">
    Uses the same deterministic checks as the unit test suite. Windows input is tested separately.
  </p>
</template>
