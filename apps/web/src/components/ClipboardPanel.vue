<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLens } from '../app/context'
const lens = useLens(),
  text = ref(''),
  message = ref(''),
  error = ref('')
const expanded = ref(false)
watch(
  () => lens.browser.state.pendingCopy,
  (proposal) => {
    if (proposal) expanded.value = true
  },
  { immediate: true },
)
async function read() {
  try {
    text.value = await lens.browser.readText()
    error.value = ''
    message.value =
      'Clipboard text loaded for your review. It has not been sent to an agent or typed.'
  } catch (e) {
    error.value = String(e)
  }
}
async function copy() {
  try {
    await lens.browser.copyText(text.value)
    error.value = ''
    message.value = 'Copied to your clipboard.'
  } catch (e) {
    error.value = String(e)
  }
}
async function approve() {
  try {
    await lens.browser.approveCopy()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
function type() {
  try {
    lens.runSequence({
      name: 'Type reviewed clipboard text',
      steps: [{ type: 'type', text: text.value }],
    })
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
</script>
<template>
  <section class="clipboard-panel">
    <details :open="expanded" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
      <summary>Clipboard and browser access</summary>
      <div class="clipboard-content">
        <p>
          Read text with a click, review it here, then choose what to copy or type. Clipboard text
          stays in this panel until you use it.
        </p>
        <div v-if="lens.browser.state.pendingCopy" class="clipboard-review" role="status">
          <h3>Review text proposed by the agent</h3>
          <pre>{{ lens.browser.state.pendingCopy.text }}</pre>
          <div class="setup-buttons">
            <button class="button primary" @click="approve">Copy approved text</button
            ><button class="button light" @click="lens.browser.denyCopy()">
              Dismiss clipboard request
            </button>
          </div>
        </div>
        <button
          class="button light"
          :disabled="!lens.browser.describe().clipboardRead"
          @click="read"
        >
          Read clipboard text
        </button>
        <label for="clipboard-text">Clipboard text to review</label
        ><textarea
          id="clipboard-text"
          v-model="text"
          rows="3"
          maxlength="2000"
          placeholder="Paste text here if clipboard permission is unavailable."
        />
        <div class="setup-buttons">
          <button
            class="button light"
            :disabled="!lens.browser.describe().clipboardWrite"
            @click="copy"
          >
            Copy this text</button
          ><button class="button light" :disabled="!text || lens.runtimeState.busy" @click="type">
            Review typing this text
          </button>
        </div>
        <p role="status">{{ message || lens.browser.state.message }}</p>
        <p v-if="error" class="notice warning" role="alert">{{ error }}</p>
        <p class="control-note">
          The browser may ask for clipboard permission. Lens cannot inspect another browser's tabs
          or read their pages directly. Use the desktop bridge to interact with visible apps. Direct
          tab access would need a separately installed extension.
        </p>
      </div>
    </details>
  </section>
</template>
