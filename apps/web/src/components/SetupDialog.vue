<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useLens } from '../app/context'
const lens = useLens(),
  dialog = ref<HTMLDialogElement>(),
  code = ref(''),
  error = ref(''),
  copying = ref('')
const lensOrigin = window.location.origin
const setupPlatform = ref(
  /Mac/i.test(navigator.platform)
    ? 'macos'
    : /Linux/i.test(navigator.platform)
      ? 'linux'
      : 'windows',
)
const bridgeCommand =
  lensOrigin === 'http://127.0.0.1:5176'
    ? 'pnpm dev:bridge'
    : `cargo run --manifest-path apps/bridge/Cargo.toml -- --origin ${lensOrigin}`
const step = computed(() =>
  !lens.screen.sharing
    ? 1
    : lens.bridgeState.status !== 'connected'
      ? 2
      : !lens.screen.geometry.calibrated
        ? 3
        : 4,
)
const displays = computed(() => lens.bridgeState.capabilities?.displays ?? [])
const selected = computed(
  () =>
    displays.value.find(
      (d) => JSON.stringify(d.bounds) === JSON.stringify(lens.screen.geometry.desktopBounds),
    )?.id ?? '',
)
watch(
  () => lens.session.setupOpen,
  async (open) => {
    await nextTick()
    if (open && !dialog.value?.open) {
      error.value = ''
      dialog.value?.showModal()
    } else if (!open && dialog.value?.open) dialog.value.close()
  },
  { immediate: true },
)
function close() {
  lens.session.setupOpen = false
}
async function share() {
  error.value = ''
  try {
    await lens.shareScreen()
  } catch (e) {
    error.value =
      'Screen sharing did not start. Choose a monitor in the browser prompt, then click Share. ' +
      String(e)
  }
}
async function pair() {
  error.value = ''
  try {
    await lens.pairBridge(code.value.trim())
    code.value = ''
  } catch (e) {
    error.value = `Could not pair. Keep the companion running. If the code was already used or control stopped, type enable in its terminal for a new code. ${String(e)}`
  }
}
async function copyCommand() {
  try {
    await lens.browser.copyText(bridgeCommand)
    copying.value = 'Command copied.'
  } catch {
    copying.value = 'Select the command above and copy it.'
  }
}
function choose(event: Event) {
  const display = displays.value.find((d) => d.id === (event.target as HTMLSelectElement).value)
  if (display) lens.screen.geometry.desktopBounds = { ...display.bounds }
  lens.screen.geometry.calibrated = false
}
function confirm() {
  try {
    lens.confirmMapping()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="setup-dialog"
    aria-labelledby="setup-title"
    @cancel.prevent="close"
    @close="close"
  >
    <div class="setup-heading">
      <div>
        <span class="eyebrow">YOUR DESKTOP</span>
        <h2 id="setup-title">
          {{ step === 4 ? 'Ready to work together' : 'Connect Lens to your desktop' }}
        </h2>
      </div>
      <button class="text-link" aria-label="Close desktop setup" @click="close">Close</button>
    </div>
    <ol class="setup-progress" aria-label="Setup progress">
      <li
        v-for="(label, i) in ['Share a screen', 'Pair the bridge', 'Choose the monitor']"
        :key="label"
        :class="{ current: step === i + 1, done: step > i + 1 }"
        :aria-current="step === i + 1 ? 'step' : undefined"
      >
        <span>{{ step > i + 1 ? '✓' : i + 1 }}</span
        >{{ label }}
      </li>
    </ol>
    <p v-if="lens.session.setupReason" class="notice warning">{{ lens.session.setupReason }}</p>
    <section v-if="step === 1" class="setup-body">
      <h3>Choose what Lens can see</h3>
      <p>
        Click Choose screen below. In the browser prompt, select one entire monitor and click Share.
      </p>
      <p>
        Keep your target app on that monitor. Put Lens on another monitor if you have one, so
        approving an action does not cover the target.
      </p>
      <button class="button primary" @click="share">Choose screen</button>
      <p class="control-note">
        The browser asks you to choose again after a reload. Lens cannot save screen-sharing
        permission.
      </p>
    </section>
    <section v-else-if="step === 2" class="setup-body">
      <h3>Start the desktop companion</h3>
      <label for="setup-platform">Your computer</label>
      <select id="setup-platform" v-model="setupPlatform">
        <option value="windows">Windows</option>
        <option value="macos">Mac</option>
        <option value="linux">Linux</option>
      </select>
      <p v-if="setupPlatform === 'windows'">
        Install Rust with the MSVC toolchain and Visual Studio C++ Build Tools.
      </p>
      <p v-else-if="setupPlatform === 'macos'">
        Install Rust and Xcode Command Line Tools. In System Settings, open Privacy &amp; Security,
        then allow Accessibility for the terminal or VS Code running the companion. Allow Screen
        Recording for the browser when sharing. Restart those apps if macOS requests it.
      </p>
      <p v-else>
        Install Rust, a C linker and libxkbcommon development files. Use an X11 desktop session with
        RandR and XTest. Wayland input is not supported yet. Choose an X11 session at login.
      </p>
      <ol class="setup-instructions">
        <li>Open this Lens project in VS Code. Choose Terminal, then New Terminal.</li>
        <li>
          Run this command and leave the terminal open.
          <div class="command-copy">
            <code>{{ bridgeCommand }}</code
            ><button class="button light" @click="copyCommand">Copy command</button>
          </div>
          <small role="status">{{ copying }}</small>
        </li>
        <li>Find the line that begins <code>Pairing code:</code>. Paste its code below.</li>
      </ol>
      <form @submit.prevent="pair">
        <label for="setup-code">Pairing code</label>
        <div class="input-row">
          <input
            id="setup-code"
            v-model="code"
            type="password"
            autocomplete="off"
            maxlength="64"
            required
            placeholder="Paste the code from the companion terminal"
            :disabled="lens.bridgeState.status === 'connecting'"
          /><button
            class="button primary"
            :disabled="!code.trim() || lens.bridgeState.status === 'connecting'"
          >
            {{ lens.bridgeState.status === 'connecting' ? 'Pairing…' : 'Pair bridge' }}
          </button>
        </div>
      </form>
      <details>
        <summary>Need a fresh code or help starting?</summary>
        <p>
          If the companion is still running, type <code>enable</code> in that terminal and press
          Enter. Use the new code once. If it has closed, run the start command again.
        </p>
        <p>
          The companion must allow this page's address, <code>{{ lensOrigin }}</code
          >. The command above sets that address. The companion stays on your computer. The project
          README has the Node, pnpm and Rust prerequisites.
        </p>
        <p v-if="lensOrigin.startsWith('https:')">
          If the browser asks to connect to your local network, allow it to reach the companion. If
          your browser blocks this connection, run Lens locally with pnpm dev:web and open
          http://127.0.0.1:5176.
        </p>
      </details>
    </section>
    <section v-else-if="step === 3" class="setup-body">
      <h3>Which monitor did you share?</h3>
      <p>
        Your shared image is {{ lens.screen.geometry.captureWidth }} ×
        {{ lens.screen.geometry.captureHeight }}. Choose that monitor below. This makes clicks land
        in the right place.
      </p>
      <label v-if="displays.length" for="shared-monitor">Shared monitor</label>
      <select v-if="displays.length" id="shared-monitor" :value="selected" @change="choose">
        <option value="" disabled>Choose the monitor you shared</option>
        <option v-for="(display, index) in displays" :key="display.id" :value="display.id">
          Monitor {{ index + 1 }}{{ display.primary ? ' · Primary' : '' }} ·
          {{ display.bounds.width }} × {{ display.bounds.height }} · position
          {{ display.bounds.x }}, {{ display.bounds.y }}
        </option>
      </select>
      <p v-else>
        The running companion does not report individual monitors. Restart it with the command in
        step 2, or enter the monitor bounds below.
      </p>
      <details :open="!displays.length">
        <summary>Window or custom capture bounds</summary>
        <p>
          For a shared window, enter its position and size in the companion's coordinates. Confirm
          again after moving or resizing it.
        </p>
        <div class="geometry-grid">
          <label v-for="key in ['x', 'y', 'width', 'height'] as const" :key="key"
            >{{ key
            }}<input
              v-model.number="lens.screen.geometry.desktopBounds[key]"
              type="number"
              @input="lens.screen.geometry.calibrated = false"
          /></label>
        </div>
      </details>
      <p class="control-note">
        {{
          lens.bridgeState.capabilities?.coordinateSpace === 'logical-points'
            ? 'This Mac uses logical display points. Retina capture pixels map to these bounds.'
            : 'The companion reports physical display pixels.'
        }}
        Saved bounds are only a suggestion. Confirm the monitor for this screen share.
      </p>
      <button class="button primary" @click="confirm">Confirm shared monitor</button>
    </section>
    <section v-else class="setup-body">
      <h3>Your next action is ready for review</h3>
      <p>
        Pairing stays active while you use Lens, including between actions and across its pages.
        Each reviewed action runs in order, and a failed step stops the sequence.
      </p>
      <p>
        For keyboard actions, approve the step and focus your target app during the three-second
        countdown.
      </p>
      <p>
        Use STOP CONTROL or Ctrl+Alt+F10 to disconnect input. Pairing also ends after 30 minutes, a
        reload, or the end of screen sharing.
      </p>
      <div class="setup-buttons">
        <button class="button primary" @click="close">Finish setup</button
        ><button class="button light" @click="lens.screen.geometry.calibrated = false">
          Change monitor
        </button>
      </div>
    </section>
    <p v-if="error" class="notice warning" role="alert">{{ error }}</p>
    <div class="setup-footer">
      <span>Raw screen frames stay in memory.</span
      ><button class="text-link" @click="lens.stop()">Stop control</button>
    </div>
  </dialog>
</template>
