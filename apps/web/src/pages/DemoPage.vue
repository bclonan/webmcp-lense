<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Paintbrush, FileText, FolderClosed, ArrowUpRight, Check } from 'lucide-vue-next'
import { demoGoals } from '@lens/fixtures'
import { useLens } from '../app/context'
const lens = useLens(),
  router = useRouter()
async function run(goal: string) {
  try {
    await lens.enableDemo(true)
    await router.push('/session')
    lens.startGoal(goal)
  } catch (e) {
    lens.session.error = String(e)
  }
}
</script>
<template>
  <section class="page-heading">
    <div class="eyebrow">THE DEMO DESKTOP</div>
    <h1>Small tasks.<br />Every step in plain sight.</h1>
    <p>
      Three applications. The same runtime, policy and tools.<br />Everything here happens inside
      your browser.
    </p>
  </section>
  <div class="demo-grid">
    <article v-for="(demo, i) in demoGoals" :key="demo.app" class="demo-card">
      <div class="demo-art" :class="`art-${i}`">
        <svg v-if="i === 0" viewBox="0 0 300 160">
          <path
            d="M80 85V135H175V85M65 89L128 28L190 89M114 135V96H140V135"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <circle cx="224" cy="42" r="19" stroke="#cc9842" fill="none" stroke-width="3" />
        </svg>
        <div v-else-if="i === 1" class="note-art">The house<br />is finished<span>▏</span></div>
        <div v-else class="claim-art">
          <span>CLAIM CLM-2048</span><strong>Ready for review.</strong
          ><span><Check :size="14" /> Human approval required</span>
        </div>
      </div>
      <div class="demo-card-body">
        <span class="eyebrow">0{{ i + 1 }} / {{ demo.kind }}</span>
        <h2>{{ demo.title }}</h2>
        <p>{{ demo.goal }}</p>
        <div class="demo-meta">
          <component :is="[Paintbrush, FileText, FolderClosed][i]" :size="15" />{{ demo.app }}
        </div>
        <button class="button primary" :disabled="lens.runtimeState.busy" @click="run(demo.goal)">
          Run {{ demo.app === 'Legacy Claims Manager' ? 'Claims' : demo.app }} demo
          <ArrowUpRight :size="16" /></button
        ><small>{{ demo.time }}</small>
      </div>
    </article>
  </div>
  <p class="demo-footnote">
    Fixture observation · Mock desktop bridge · No API key · No installation
  </p>
  <p v-if="lens.session.error" role="alert" class="notice warning">{{ lens.session.error }}</p>
</template>
