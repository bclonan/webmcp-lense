<script setup lang="ts">
import { ref } from 'vue'
import { useLens } from '../app/context'
const lens = useLens(),
  code = ref('')
async function pair() {
  try {
    await lens.pairBridge(code.value)
    code.value = ''
  } catch (e) {
    lens.session.error = String(e)
    code.value = ''
  }
}
function calibrate() {
  const g = lens.screen.geometry,
    b = lens.bridgeState.capabilities?.desktopBounds,
    m = g.desktopBounds
  if (
    !b ||
    ![m.x, m.y, m.width, m.height].every(Number.isFinite) ||
    m.width < 2 ||
    m.height < 2 ||
    m.x < b.x ||
    m.y < b.y ||
    m.x + m.width > b.x + b.width ||
    m.y + m.height > b.y + b.height
  ) {
    lens.session.error = 'Capture bounds must fit inside the desktop reported by the bridge.'
    return
  }
  g.calibrated = true
}
</script>
<template>
  <section class="connection-panel">
    <h3>Connect your desktop</h3>
    <p>Run the local bridge, then enter its pairing code. Ctrl+Alt+F10 stops input on Windows.</p>
    <form v-if="lens.bridgeState.status !== 'connected'" @submit.prevent="pair">
      <label for="pair-code">Pairing code</label>
      <div class="input-row">
        <input
          id="pair-code"
          v-model="code"
          type="password"
          autocomplete="off"
          maxlength="64"
          required
          placeholder="Code from bridge console"
        /><button
          class="button primary"
          :disabled="!lens.screen.sharing || lens.bridgeState.status === 'connecting'"
        >
          Pair bridge
        </button>
      </div>
    </form>
    <div v-else>
      <p>
        Map the captured screen or window to physical desktop pixels. For a single shared monitor,
        enter that monitor's bounds. For a window, enter its captured content bounds. Recalibrate
        after moving or resizing it.
      </p>
      <div class="geometry-grid">
        <label v-for="key in ['x', 'y', 'width', 'height'] as const" :key="key"
          >{{ key
          }}<input
            type="number"
            v-model.number="lens.screen.geometry.desktopBounds[key]"
            :disabled="lens.runtimeState.busy"
            @input="lens.screen.geometry.calibrated = false"
        /></label>
      </div>
      <button class="button light" :disabled="lens.runtimeState.busy" @click="calibrate">
        {{ lens.screen.geometry.calibrated ? 'Mapping confirmed' : 'Confirm capture mapping' }}
      </button>
    </div>
  </section>
</template>
