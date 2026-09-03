<script setup lang="ts">
import { computed, ref } from 'vue'
const step = ref(0)
const rows = [
  ['Inspect a screenshot or DOM', 'Discover declared tools'],
  ['Infer what each control means', 'Read purpose and argument schemas'],
  ['Find and manipulate the control', 'Submit structured arguments'],
  ['Inspect the screen again', 'Read the result and goal status'],
  ['Rework selectors when the layout changes', 'Keep the tool contract across layout changes'],
]
const oldSteps = [
  'Read a screenshot of the Lens workspace.',
  'Find the enable control button; the person enables control.',
  'Locate the goal field and enter the Paint request.',
  'Locate Run goal and click it.',
  'Reinspect the canvas and completion label.',
]
const newSteps = [
  'Discover goal_start and goal_status.',
  'Read the schemas; the person enables demo control.',
  'Submit the Paint goal with goal_start.',
  'Read goal_status until it reports completed.',
  'Read screen_get_context to inspect the fixture result.',
]
const result = computed(() =>
  step.value === 5
    ? 'House and sun complete, simulated'
    : step.value
      ? 'In progress, simulated'
      : 'Not started',
)
</script>
<template>
  <div class="docs-two">
    <article class="docs-card">
      <span class="eyebrow">UI-DRIVEN AGENT</span>
      <h3>Work out the interface each time</h3>
      <ol>
        <li v-for="row in rows" :key="row[0]">{{ row[0] }}</li>
      </ol>
    </article>
    <article class="docs-card docs-tint">
      <span class="eyebrow">WEBMCP AGENT</span>
      <h3>Use the application’s declared actions</h3>
      <ol>
        <li v-for="row in rows" :key="row[1]">{{ row[1] }}</li>
      </ol>
    </article>
  </div>
  <div class="docs-card">
    <h3>One goal, two routes to a house and sun</h3>
    <p>
      This is an isolated, illustrative walkthrough. Counts describe this scripted example, not
      measurements or a benchmark. It never calls a tool or changes your desktop. Real WebMCP
      actions still observe and verify the target.
    </p>
    <div class="docs-two">
      <p>{{ oldSteps[Math.max(0, step - 1)] }}</p>
      <p>{{ newSteps[Math.max(0, step - 1)] }}</p>
    </div>
    <div class="table-scroll">
      <table>
        <caption>
          Illustrative counts after step
          {{
            step
          }}
          of 5
        </caption>
        <thead>
          <tr>
            <th>Method</th>
            <th>Observations</th>
            <th>UI operations</th>
            <th>Tool calls</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>UI-driven agent</th>
            <td>{{ step === 5 ? 2 : step ? 1 : 0 }}</td>
            <td>{{ Math.min(3, Math.max(0, step - 1)) }}</td>
            <td>0</td>
            <td>{{ result }}</td>
          </tr>
          <tr>
            <th>WebMCP agent</th>
            <td>{{ step === 5 ? 1 : 0 }}</td>
            <td>{{ step >= 2 ? 1 : 0 }}</td>
            <td>{{ Math.max(0, step - 2) }}</td>
            <td>{{ result }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="docs-actions">
      <button class="button primary" :disabled="step === 5" @click="step++">
        Next comparison step</button
      ><button class="text-link" @click="step = 0">Reset comparison</button
      ><span role="status">{{ result }}</span>
    </div>
  </div>
</template>
