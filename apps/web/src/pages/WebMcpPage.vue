<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useLens } from '../app/context'
import { documentationModel, runDocumentationTool } from '../content/toolDocs'
import { promptLibrary } from '../content/workflows'
import project from '../content/project.json'
import CopyButton from '../components/CopyButton.vue'
import WorkflowGuide from '../components/WorkflowGuide.vue'
import WorkflowComparison from '../components/WorkflowComparison.vue'
const lens = useLens()
const catalog = computed(() => documentationModel(lens.tools))
const search = ref(''),
  category = ref('All'),
  level = ref('All')
const visible = computed(() =>
  catalog.value.filter((t) =>
    `${t.name} ${t.title} ${t.description}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const prompts = computed(() =>
  promptLibrary.filter(
    (p) =>
      (category.value === 'All' || p.group === category.value) &&
      (level.value === 'All' || p.level === level.value),
  ),
)
const latest = computed(
  () => Object.entries(lens.tools.invocations).sort((a, b) => b[1].at - a[1].at)[0],
)
const valid = computed(() => catalog.value.filter((t) => t.exampleValid && t.resultValid).length)
const selected = ref(''),
  input = ref('{}'),
  result = ref<unknown>(null),
  running = ref(false)
const preview = ref<HTMLDialogElement>()
let pending: AbortController | undefined
const active = computed(() => catalog.value.find((t) => t.name === selected.value))
function select(name: string) {
  pending?.abort()
  selected.value = name
  input.value = JSON.stringify(active.value?.arguments ?? {}, null, 2)
  result.value = null
}
function validate() {
  try {
    const value = JSON.parse(input.value)
    lens.tools.definitions.find((t) => t.name === selected.value)!.schema.parse(value)
    result.value = { ok: true, data: { validation: 'Arguments are valid. No operation executed.' } }
    return value
  } catch (error) {
    result.value = {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    }
    return undefined
  }
}
async function run() {
  if (running.value || !active.value?.readOnly) return
  const value = validate()
  if (value === undefined) return
  running.value = true
  const controller = new AbortController()
  pending = controller
  try {
    const response = await runDocumentationTool(
      lens.tools,
      selected.value,
      value,
      controller.signal,
    )
    if (!controller.signal.aborted) result.value = response
  } finally {
    running.value = false
  }
}
function review(name: string) {
  select(name)
  preview.value?.showModal()
}
onBeforeUnmount(() => {
  pending?.abort()
  preview.value?.close()
})
</script>
<template>
  <div class="docs-page">
    <header class="docs-hero">
      <span class="eyebrow">LENS / WEBMCP</span>
      <h1>A shared workspace.<br />Declared actions.</h1>
      <p>
        Inspect what Lens sees, propose the next step, and read what happened. These
        {{ catalog.length }} tools use the same services, state and approval controls as the
        interface.
      </p>
      <div class="docs-actions">
        <a href="#catalog" class="button primary">Explore {{ catalog.length }} tools</a
        ><a href="#prompts" class="text-link">Find a prompt</a
        ><RouterLink to="/hackathon" class="text-link">Project overview</RouterLink>
      </div>
    </header>
    <nav class="docs-nav" aria-label="WebMCP documentation sections">
      <a href="#introduction">Introduction</a><a href="#comparison">Compare approaches</a
      ><a href="#catalog">Tool catalog</a><a href="#prompts">Prompt library</a
      ><a href="#chains">Chained workflows</a><a href="#inspector">Live inspector</a>
    </nav>
    <section id="introduction" class="docs-section">
      <span class="eyebrow">ONE APPLICATION STATE</span>
      <h2>What WebMCP changes in Lens</h2>
      <div class="docs-two">
        <div>
          <p>
            WebMCP lets a page declare structured JavaScript tools for browser agents. Lens uses
            imperative registration: its tools have names, strict input schemas and validated
            results. An agent can request a goal without hunting for the goal field.
          </p>
          <p>
            A person can run demos, share a screen, pair the bridge, confirm a monitor, approve
            actions, edit workflows and export files. An agent can inspect observations, propose
            bounded actions, follow progress and prepare recordings through declared tools.
          </p>
        </div>
        <div>
          <p>
            Both paths call <code>LensService</code> and the same runtime. Pinia updates the visible
            Workspace; IndexedDB retains events and workflows. Acceptance receipts start work. They
            do not prove completion.
          </p>
          <p>
            Tools cannot enable control, choose a screen, pair the bridge or grant approval. Live
            desktop actions require human review. Clipboard writes and file downloads use visible
            buttons. Live vision is not configured; semantic demo results come from fixtures.
          </p>
        </div>
      </div>
      <p class="docs-source">
        Background:
        <a href="https://developer.chrome.com/blog/webmcp-epp" target="_blank" rel="noreferrer"
          >Chrome’s early-preview introduction</a
        >
        and the
        <a href="https://webmachinelearning.github.io/webmcp/" target="_blank" rel="noreferrer"
          >WebMCP draft</a
        >. Browser support varies; Lens feature-detects its existing API.
      </p>
    </section>
    <section id="comparison" class="docs-section">
      <h2>From finding controls to calling actions</h2>
      <WorkflowComparison />
      <p>
        Presentation changes do not change a stable tool contract. A tool rename, schema change or
        target desktop change still needs compatibility work. Lens continues to observe after input.
      </p>
    </section>
    <section id="catalog" class="docs-section">
      <div class="docs-section-heading">
        <div>
          <span class="eyebrow">GENERATED FROM THE REGISTRY</span>
          <h2>Every tool, documented</h2>
        </div>
        <span class="docs-badge">{{ catalog.length }} tools · {{ valid }} valid examples</span>
      </div>
      <p>
        Input schemas and arguments below come directly from the registered definitions. Results are
        schema-validated illustrative responses, not live receipts. Observation tools are read-only
        with respect to desktop input, but may refresh the observation and timeline.
      </p>
      <label for="tool-search">Find a tool</label
      ><input
        id="tool-search"
        v-model="search"
        type="search"
        placeholder="Search by name, task or description"
      />
      <p role="status">{{ visible.length }} of {{ catalog.length }} tools</p>
      <article
        v-for="tool in visible"
        :id="`tool-${tool.name}`"
        :key="tool.name"
        class="docs-card tool-doc"
        :data-tool-name="tool.name"
      >
        <div class="docs-section-heading">
          <div>
            <h3>{{ tool.title }}</h3>
            <code>{{ tool.name }}</code>
          </div>
          <span class="docs-badge">{{ tool.classification }}</span>
        </div>
        <p>{{ tool.description }}</p>
        <p><b>State affected.</b> {{ tool.state }}</p>
        <p v-if="tool.name === 'desktop_press' || tool.name === 'goal_rerun'" class="docs-callout">
          May delete, save, close or repeat changes in a target application. Review the exact
          operation in Workspace.
        </p>
        <details>
          <summary>Arguments and JSON Schema</summary>
          <ul v-if="tool.properties.length">
            <li v-for="property in tool.properties" :key="property.name">
              <code>{{ property.name }}</code> · {{ property.required ? 'required' : 'optional' }}
            </li>
          </ul>
          <p v-else>No input properties. Pass <code>{}</code>.</p>
          <p v-if="tool.schema.oneOf">
            Exactly one of <code>targetId</code> or <code>point</code> is required; the schema
            enforces this condition.
          </p>
          <pre>{{ JSON.stringify(tool.schema, null, 2) }}</pre>
          <h4>Representative valid arguments</h4>
          <pre>{{ JSON.stringify(tool.arguments, null, 2) }}</pre>
        </details>
        <details>
          <summary>Structured result, errors and source</summary>
          <p>Illustrative success envelope; IDs and timestamps are examples.</p>
          <pre>{{ JSON.stringify(tool.result, null, 2) }}</pre>
          <p>
            <code>VALIDATION_ERROR</code> means input or returned data failed validation.
            <code>ACTION_ERROR</code> covers unsupported, busy or unavailable state.
            <code>CANCELLED</code> means the caller aborted. An accepted goal can later fail in
            <code>goal_status</code>.
          </p>
          <p>{{ tool.recovery }}</p>
          <pre>{{
            JSON.stringify(
              { ok: false, error: { code: 'ACTION_ERROR', message: tool.recovery } },
              null,
              2,
            )
          }}</pre>
          <p>
            Defined in
            <a
              :href="`${project.repositoryUrl}/blob/bridge/${tool.source}`"
              target="_blank"
              rel="noreferrer"
              ><code>{{ tool.source }}</code></a
            >; registered by <code>{{ tool.registration }}</code> at application startup.
          </p>
          <pre>{{ JSON.stringify(tool.annotations, null, 2) }}</pre>
        </details>
        <p class="docs-prompt">{{ tool.prompt }}</p>
        <div class="docs-actions">
          <CopyButton :text="tool.prompt" /><CopyButton
            :text="JSON.stringify(tool.arguments, null, 2)"
            label="Copy arguments"
          /><CopyButton :text="tool.name" label="Copy tool name" /><button
            v-if="tool.readOnly"
            class="button light"
            @click="select(tool.name)"
          >
            Try {{ tool.name }}</button
          ><button v-else class="button light" @click="review(tool.name)">
            Preview {{ tool.name }}
          </button>
        </div>
        <form
          v-if="selected === tool.name && tool.readOnly"
          class="docs-callout"
          @submit.prevent="run"
        >
          <label :for="`args-${tool.name}`">Arguments for {{ tool.name }}</label
          ><textarea
            :id="`args-${tool.name}`"
            v-model="input"
            rows="4"
            spellcheck="false"
            :disabled="running"
          />
          <div class="docs-actions">
            <button class="button primary" :disabled="running">
              {{ running ? 'Running…' : 'Run read-only tool' }}</button
            ><button type="button" class="text-link" @click="validate">Validate arguments</button>
          </div>
          <pre v-if="result" aria-label="Documentation tool result" role="status">{{
            JSON.stringify(result, null, 2)
          }}</pre>
        </form>
      </article>
    </section>
    <section id="prompts" class="docs-section">
      <span class="eyebrow">START WITH YOUR GOAL</span>
      <h2>A prompt for the work ahead</h2>
      <p>
        Copy a prompt into an agent connected to this Lens page. These are instructions to review,
        not automatic execution buttons.
      </p>
      <div class="docs-filters">
        <label
          >Task<select v-model="category">
            <option>All</option>
            <option v-for="p in promptLibrary" :key="p.group">{{ p.group }}</option>
          </select></label
        ><label
          >Experience<select v-model="level">
            <option>All</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Showcase</option>
          </select></label
        >
      </div>
      <div class="docs-two">
        <article v-for="p in prompts" :key="p.group" class="docs-card">
          <span class="eyebrow">{{ p.level }}</span>
          <h3>{{ p.group }}</h3>
          <p>{{ p.prompt }}</p>
          <div class="docs-actions">
            <a v-for="name in p.tools" :key="name" :href="`#tool-${name}`" @click="search = ''"
              ><code>{{ name }}</code></a
            >
          </div>
          <CopyButton :text="p.prompt" />
        </article>
      </div>
      <p v-if="!prompts.length" role="status">
        No prompts match these filters. Choose All to see the library.
      </p>
    </section>
    <section id="chains" class="docs-section">
      <span class="eyebrow">RESULTS BECOME THE NEXT INPUT</span>
      <h2>Five workflows you can follow</h2>
      <p>
        The stepper documents order and data dependencies. It does not execute a chain. Polls,
        approval waits and conditional recovery are described at each step.
      </p>
      <WorkflowGuide />
    </section>
    <section id="inspector" class="docs-section">
      <h2>Live tool inspector</h2>
      <div class="docs-callout" role="status">
        <b>{{ lens.tools.status.mode }}</b>
        <p>
          {{
            lens.tools.status.mode === 'Native WebMCP'
              ? `${catalog.length} tools registered through document.modelContext.`
              : 'Native WebMCP is unavailable in this browser. The catalog and local read-only tests use the same registry and validators.'
          }}
        </p>
        <p v-if="lens.tools.status.error">{{ lens.tools.status.error }}</p>
        <p>
          Schema checks: {{ valid }} of {{ catalog.length }} example argument and result pairs
          valid.
        </p>
      </div>
      <details>
        <summary>Registered names and validation status</summary>
        <ul>
          <li v-for="tool in catalog" :key="tool.name">
            <code>{{ tool.name }}</code> ·
            {{
              tool.exampleValid && tool.resultValid ? 'valid examples' : 'example needs attention'
            }}
          </li>
        </ul>
      </details>
      <div v-if="latest" class="docs-card">
        <h3>Most recent call: {{ latest[0] }}</h3>
        <p>{{ new Date(latest[1].at).toLocaleString() }}</p>
        <details>
          <summary>Arguments</summary>
          <pre>{{ JSON.stringify(latest[1].input, null, 2) }}</pre>
        </details>
        <pre aria-label="Latest structured tool result">{{
          JSON.stringify(latest[1].result, null, 2)
        }}</pre>
      </div>
      <p v-else>No tools have been called in this page session yet. Try a read-only tool above.</p>
      <p>
        Registration belongs to <code>app/main.ts</code>. Navigating between these pages retains the
        registry. Closing or reloading the document aborts its registrations and stops control.
      </p>
    </section>
    <dialog ref="preview" class="docs-preview" aria-labelledby="operation-preview-title">
      <h2 id="operation-preview-title">Review this operation</h2>
      <p>{{ active?.description }}</p>
      <p>{{ active?.state }}</p>
      <label for="preview-arguments">Preview arguments</label
      ><textarea id="preview-arguments" v-model="input" rows="6" spellcheck="false" /><button
        class="button light"
        @click="validate"
      >
        Validate arguments
      </button>
      <pre v-if="result" role="status">{{ JSON.stringify(result, null, 2) }}</pre>
      <p>
        This preview sends no action. Open Workspace, inspect the target and use its existing
        controls and approvals. Copying arguments does not authorize execution.
      </p>
      <div class="docs-actions">
        <CopyButton :text="input" label="Copy arguments" /><RouterLink
          class="button primary"
          to="/session"
          >Continue to Workspace</RouterLink
        ><button class="text-link" @click="preview?.close()">Close preview</button>
      </div>
    </dialog>
  </div>
</template>
