<script setup lang="ts">
import { Aperture, ArrowUpRight, Square } from 'lucide-vue-next'
import { useLens } from './context'
import SetupDialog from '../components/SetupDialog.vue'
import AppUpdate from '../components/AppUpdate.vue'
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
        <RouterLink
          class="webmcp-indicator"
          to="/session#workspace-tools"
          :title="lens.tools.status.error || lens.tools.status.mode"
          aria-label="WebMCP status and tools"
        >
          <i :class="{ on: lens.tools.status.mode === 'Native WebMCP' }" />
          <span
            >WebMCP
            <b>{{ lens.tools.status.mode === 'Native WebMCP' ? 'connected' : 'local' }}</b></span
          >
          <span>{{ lens.tools.definitions.length }} tools</span> </RouterLink
        ><button class="stop-button" @click="lens.stop()">
          <Square :size="12" fill="currentColor" /> STOP CONTROL
        </button>
      </div>
    </header>
    <AppUpdate />
    <div
      v-if="lens.session.mode === 'live' && lens.screen.sharing"
      class="connection-banner"
      role="status"
    >
      <span
        >Screen sharing is active.
        {{
          lens.bridgeState.status === 'connected'
            ? 'Desktop paired. Connection stays open across Lens pages.'
            : 'Pair the desktop to enable input.'
        }}</span
      ><RouterLink to="/session">Return to workspace</RouterLink>
    </div>
    <div v-if="lens.browser.state.pendingCopy" class="connection-banner">
      <span>A clipboard request needs your review.</span
      ><RouterLink to="/session">Review in workspace</RouterLink>
    </div>
    <div v-if="lens.approvals.pending" class="connection-banner">
      <span>A desktop action needs your approval.</span
      ><RouterLink to="/session">Review action in workspace</RouterLink>
    </div>
    <div v-if="lens.session.persistenceError" class="notice warning" role="status">
      {{ lens.session.persistenceError }}
    </div>
    <main><RouterView /></main>
    <SetupDialog />
    <footer class="site-footer">
      <span>Lens <span class="dim">/</span> A screen-to-action experiment</span
      ><span>Your screen. Your permission. Your control. <ArrowUpRight :size="13" /></span>
    </footer>
  </div>
</template>
