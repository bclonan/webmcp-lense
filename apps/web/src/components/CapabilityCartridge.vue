<script setup lang="ts">
import { ref, watch } from 'vue'
import { Play, Pencil, Download, Package } from 'lucide-vue-next'
import type { CapabilityCartridge } from '@lens/protocol'
import { useLens } from '../app/context'
const props = defineProps<{ cartridge: CapabilityCartridge }>(),
  lens = useLens()
const editing = ref(false),
  json = ref(''),
  error = ref(''),
  variables = ref({ ...props.cartridge.inputs })
watch(
  () => props.cartridge,
  (c) => {
    variables.value = { ...c.inputs }
  },
)
function edit() {
  json.value = JSON.stringify(props.cartridge, null, 2)
  editing.value = true
  error.value = ''
}
async function save() {
  try {
    await lens.saveCartridge(JSON.parse(json.value))
    editing.value = false
  } catch (e) {
    error.value = String(e)
  }
}
function run() {
  try {
    lens.runCartridge(props.cartridge, variables.value)
  } catch (e) {
    error.value = String(e)
  }
}
function download() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(props.cartridge, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `lens-${props.cartridge.id}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<template>
  <article class="cartridge-card">
    <div class="cartridge-title">
      <Package :size="18" />
      <div>
        <h3>{{ cartridge.name }}</h3>
        <span
          >{{ cartridge.application }} · {{ cartridge.steps.length }} steps · v{{
            cartridge.version
          }}</span
        >
      </div>
    </div>
    <p>{{ cartridge.description }}</p>
    <label v-for="(_, key) in cartridge.inputs" :key="key" class="variable-input"
      >{{ key }}<input v-model="variables[key]" maxlength="500"
    /></label>
    <div class="cartridge-actions">
      <button
        class="button light"
        :disabled="lens.runtimeState.busy || !lens.session.authorized"
        @click="run"
      >
        <Play :size="12" /> Run</button
      ><button class="button light" @click="edit"><Pencil :size="12" /> Edit</button
      ><button class="button light" @click="download"><Download :size="12" /> Export</button>
    </div>
    <div v-if="editing" class="cartridge-editor">
      <label :for="`edit-${cartridge.id}`">Cartridge JSON</label
      ><textarea :id="`edit-${cartridge.id}`" v-model="json" spellcheck="false" rows="14" />
      <div class="cartridge-actions">
        <button class="button primary" @click="save">Save cartridge</button
        ><button class="button light" @click="editing = false">Cancel</button>
      </div>
    </div>
    <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
  </article>
</template>
