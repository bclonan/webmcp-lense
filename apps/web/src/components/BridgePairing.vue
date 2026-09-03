<script setup lang="ts">
import { useLens } from '../app/context'
const lens = useLens()
</script>
<template>
  <section class="connection-panel connection-summary">
    <div>
      <h3>
        {{ lens.bridgeState.status === 'connected' ? 'Desktop paired' : 'Desktop setup needed' }}
      </h3>
      <p v-if="lens.bridgeState.status === 'connected'">
        {{
          lens.screen.geometry.calibrated
            ? 'Monitor confirmed. Ready for the next action.'
            : 'Choose the monitor you shared to finish setup.'
        }}
        <span v-if="lens.bridgeState.expiresAt"
          >Paired until
          {{
            new Date(lens.bridgeState.expiresAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })
          }}.</span
        >
      </p>
      <p v-else>Share a monitor, start the companion, and enter its pairing code.</p>
    </div>
    <button class="button light" :disabled="lens.runtimeState.busy" @click="lens.requestSetup()">
      {{ lens.bridgeState.status === 'connected' ? 'Connection settings' : 'Set up desktop' }}
    </button>
  </section>
</template>
