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
      <p v-if="lens.bridgeState.status === 'connected'">
        {{ lens.bridgeState.capabilities?.device }} · Bridge
        {{ lens.bridgeState.capabilities?.bridgeVersion }} · Protocol
        {{ lens.bridgeState.capabilities?.protocolVersion }} <br />{{
          lens.bridgeState.capabilities?.commands.join(', ')
        }}
        <br />Latency {{ lens.bridgeState.latencyMs }} ms. Last checked
        {{ new Date(lens.bridgeState.testedAt).toLocaleTimeString() }}.
      </p>
    </div>
    <button class="button light" :disabled="lens.runtimeState.busy" @click="lens.requestSetup()">
      {{ lens.bridgeState.status === 'connected' ? 'Connection settings' : 'Set up desktop' }}
    </button>
    <template v-if="lens.bridgeState.status === 'connected'">
      <button
        class="button light"
        :disabled="lens.runtimeState.busy"
        @click="lens.checkConnection()"
      >
        Test connection
      </button>
      <button class="button light" @click="lens.stop()">Disconnect</button>
    </template>
    <button
      v-else
      class="button light"
      @click="
        lens.requestSetup('Click New pairing code in Lens Bridge, then enter the fresh code.')
      "
    >
      Reconnect
    </button>
  </section>
</template>
