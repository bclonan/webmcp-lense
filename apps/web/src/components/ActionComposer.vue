<script setup lang="ts">
import { computed, ref } from 'vue'
import { keySchema, sequenceSchema } from '@lens/schemas'
import type { CartridgeStep } from '@lens/protocol'
import { useLens } from '../app/context'
const lens = useLens(),
  kind = ref('type'),
  text = ref('Hello from Lens.'),
  key = ref('ENTER')
const x = ref(50),
  y = ref(50),
  delta = ref(-120),
  button = ref<'left' | 'right'>('left')
const path = ref('[{"x":0.3,"y":0.5},{"x":0.6,"y":0.5}]'),
  name = ref('My desktop sequence')
const steps = ref<CartridgeStep[]>([]),
  error = ref('')
const keys = computed(() =>
  keySchema.options.filter(
    (key) =>
      lens.bridgeState.capabilities?.keys?.includes(key) ??
      (!key.startsWith('CMD+') || lens.bridgeState.capabilities?.platform === 'macos'),
  ),
)
function draft(): CartridgeStep {
  const values = {
    type: { type: 'type', text: text.value },
    press: { type: 'press', key: key.value },
    click: { type: 'click', point: { x: x.value / 100, y: y.value / 100 }, button: button.value },
    scroll: { type: 'scroll', delta: delta.value },
    drag: {
      type: 'drag',
      points: kind.value === 'drag' ? JSON.parse(path.value) : [],
      durationMs: 600,
    },
  }
  return sequenceSchema.parse({
    name: 'Action',
    steps: [values[kind.value as keyof typeof values]],
  }).steps[0] as CartridgeStep
}
function add() {
  try {
    if (steps.value.length >= 20) throw new Error('A sequence can contain up to 20 steps.')
    steps.value.push(draft())
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
function run(single = false) {
  try {
    lens.runSequence({
      name: single ? 'Desktop action' : name.value,
      steps: single ? [draft()] : steps.value,
    })
    error.value = ''
  } catch (e) {
    error.value = String(e)
  }
}
function summary(s: CartridgeStep) {
  if (s.type === 'type') return `Type "${s.text?.slice(0, 70)}"`
  if (s.type === 'press') return `Press ${s.key}`
  if (s.type === 'click')
    return `Click ${Math.round((s.point?.x ?? 0) * 100)}%, ${Math.round((s.point?.y ?? 0) * 100)}%`
  if (s.type === 'scroll') return `Scroll ${s.delta}`
  return 'Drag along the selected path'
}
</script>
<template>
  <div class="composer sequence-composer">
    <p class="live-note">
      Build a sequence or run one action. Lens reviews each step, then checks the screen before
      continuing.
    </p>
    <fieldset :disabled="lens.runtimeState.busy">
      <label for="action-kind">Action</label
      ><select id="action-kind" v-model="kind">
        <option value="type">Type text</option>
        <option value="press">Press a key</option>
        <option value="click">Click a point</option>
        <option value="scroll">Scroll</option>
        <option value="drag">Drag a path</option>
      </select>
      <template v-if="kind === 'type'"
        ><label for="action-text">Text to type</label
        ><textarea id="action-text" v-model="text" maxlength="2000" rows="3" />
        <p class="control-note">
          After approval, focus the intended app during the three-second countdown.
        </p></template
      >
      <template v-if="kind === 'press'"
        ><label for="action-key">Key</label
        ><select id="action-key" v-model="key">
          <option v-for="k in keys" :key="k">{{ k }}</option>
        </select></template
      >
      <template v-if="kind === 'click'"
        ><div class="geometry-grid two">
          <label
            >Horizontal %<input
              v-model.number="x"
              type="number"
              min="0"
              max="100"
              step="0.1" /></label
          ><label
            >Vertical %<input v-model.number="y" type="number" min="0" max="100" step="0.1"
          /></label>
        </div>
        <label for="mouse-button">Mouse button</label
        ><select id="mouse-button" v-model="button">
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
        <p class="control-note">0%, 0% is the top-left of the shared screen.</p></template
      >
      <template v-if="kind === 'scroll'"
        ><label for="scroll-distance">Scroll amount</label
        ><input
          id="scroll-distance"
          v-model.number="delta"
          type="number"
          min="-1200"
          max="1200"
          step="120"
        />
        <p class="control-note">
          Negative values scroll down, positive values scroll up, at the current pointer.
        </p></template
      >
      <template v-if="kind === 'drag'"
        ><label for="drag-path">Normalized path points</label
        ><textarea id="drag-path" v-model="path" rows="3" spellcheck="false" />
        <p class="control-note">
          Use 2 to 128 x/y points between 0 and 1. The drag takes 600 ms.
        </p></template
      >
      <div class="setup-buttons">
        <button class="button light" @click="add">Add step</button
        ><button class="button primary" @click="run(true)">Review this action</button>
      </div>
      <div v-if="steps.length" class="sequence-draft">
        <label for="sequence-name">Sequence name</label
        ><input id="sequence-name" v-model="name" maxlength="100" />
        <ol>
          <li v-for="(s, i) in steps" :key="i">
            <span>{{ summary(s) }}</span
            ><button
              class="text-link"
              :aria-label="`Remove step ${i + 1}`"
              @click="steps.splice(i, 1)"
            >
              Remove
            </button>
          </li>
        </ol>
        <button class="button primary full" @click="run()">
          Review {{ steps.length }} steps in order
        </button>
      </div>
    </fieldset>
    <p v-if="error" role="alert" class="notice warning">{{ error }}</p>
  </div>
</template>
