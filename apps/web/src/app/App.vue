<script setup lang="ts">
import { Aperture, ArrowUpRight, Square } from 'lucide-vue-next'
import { useLens } from './context'
const lens = useLens()
</script>
<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink to="/" class="brand" aria-label="Lens home"
        ><Aperture :size="29" :stroke-width="1.5" /> lens<span class="brand-dot"
          >.</span
        ></RouterLink
      >
      <nav aria-label="Main navigation">
        <RouterLink to="/session">Workspace</RouterLink><RouterLink to="/demo">Demos</RouterLink
        ><RouterLink to="/tools">Tools</RouterLink><RouterLink to="/evals">Evals</RouterLink
        ><RouterLink to="/settings">Settings</RouterLink>
      </nav>
      <div class="header-end">
        <span class="local-tag"><i /> Local by design</span
        ><button class="stop-button" @click="lens.stop()">
          <Square :size="12" fill="currentColor" /> STOP CONTROL
        </button>
      </div>
    </header>
    <div v-if="lens.session.persistenceError" class="notice warning" role="status">
      {{ lens.session.persistenceError }}
    </div>
    <main><RouterView /></main>
    <footer class="site-footer">
      <span>Lens <span class="dim">/</span> A screen-to-action experiment</span
      ><span>Your screen. Your permission. Your control. <ArrowUpRight :size="13" /></span>
    </footer>
  </div>
</template>
