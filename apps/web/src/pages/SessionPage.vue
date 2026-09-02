<script setup lang="ts">
import { ref } from 'vue'
import {
  ArrowUpRight,
  Play,
  ScanLine,
  Check,
  CircleStop,
  MousePointer2,
  Monitor,
} from 'lucide-vue-next'
import { useLens } from '../app/context'
import MockDesktop from '../components/MockDesktop.vue'
import EventTimeline from '../components/EventTimeline.vue'
import LiveScreen from '../components/LiveScreen.vue'
import BridgePairing from '../components/BridgePairing.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'
const lens = useLens(),
  goal = ref('Open Paint and draw a small house with a sun.')
const manual = ref('desktop_press'),
  payload = ref('{"key":"WIN"}')
async function enable() {
  try {
    await lens.enableDemo()
  } catch (e) {
    lens.session.error = String(e)
  }
}
function run() {
  try {
    lens.startGoal(goal.value)
  } catch (e) {
    lens.session.error = String(e)
  }
}
async function share() {
  try {
    await lens.shareScreen()
  } catch (e) {
    lens.session.error = String(e)
  }
}
async function act() {
  try {
    const result = await lens.tools.invoke(manual.value, JSON.parse(payload.value))
    if (!result.ok) lens.session.error = result.error.message
  } catch (e) {
    lens.session.error = String(e)
  }
}
function example() {
  payload.value = JSON.stringify(
    lens.tools.definitions.find((t) => t.name === manual.value)?.example,
    null,
    2,
  )
}
function dismissError() {
  lens.session.error = ''
  lens.bridgeState.error = ''
}
</script>
<template>
  <section class="workspace-heading">
    <div>
      <div class="eyebrow">YOUR WORKSPACE</div>
      <h1>See. Act. Verify.</h1>
    </div>
    <div class="workspace-actions">
      <button class="text-link" :disabled="lens.runtimeState.busy" @click="share">
        <Monitor :size="14" /> Share Screen</button
      ><RouterLink to="/demo" class="text-link"
        >Choose a demo <ArrowUpRight :size="15"
      /></RouterLink>
    </div>
  </section>
  <div class="status-strip">
    <span
      ><i :class="{ on: lens.session.mode === 'demo' || lens.screen.sharing }" /> Screen
      <b>{{
        lens.session.mode === 'demo'
          ? 'Demo desktop'
          : lens.screen.sharing
            ? 'Sharing'
            : 'Not shared'
      }}</b></span
    ><span
      ><i :class="{ on: lens.bridgeState.status === 'connected' }" /> Bridge
      <b>{{ lens.bridgeState.status }}</b></span
    ><span
      ><i :class="{ on: lens.tools.status.mode === 'Native WebMCP' }" /> WebMCP
      <b>{{ lens.tools.status.mode }}</b></span
    ><span class="source-label"
      >Observation / {{ lens.screen.observation?.source ?? 'unavailable' }}</span
    >
  </div>
  <div v-if="lens.session.error || lens.bridgeState.error" role="alert" class="notice warning">
    {{ lens.session.error || lens.bridgeState.error }}
    <button @click="dismissError">Dismiss</button>
  </div>
  <div class="workspace-grid">
    <section class="screen-panel">
      <div class="panel-header">
        <h2><ScanLine :size="16" /> Shared view</h2>
        <label v-if="lens.session.mode === 'demo'" class="toggle-label"
          ><input v-model="lens.screen.regionsVisible" type="checkbox" /> Visual regions</label
        ><button v-else class="text-link" @click="lens.capture.stop()">Stop sharing</button>
      </div>
      <MockDesktop
        v-if="lens.session.mode === 'demo'"
        :desktop="lens.screen.desktop"
        :regions="lens.screen.observation?.regions"
        :show-regions="lens.screen.regionsVisible"
        :target-id="lens.runtimeState.proposed?.targetId"
      /><LiveScreen v-else />
      <div class="screen-caption">
        <span
          ><i class="on" /> {{ lens.session.mode === 'demo' ? 'MOCK DESKTOP' : 'LIVE CAPTURE' }} ·
          {{ lens.screen.geometry.captureWidth }} × {{ lens.screen.geometry.captureHeight }}</span
        ><span>{{ lens.screen.observation?.regions.length ?? 0 }} regions identified</span>
      </div>
      <div class="observation">
        <span class="eyebrow">WHAT LENS SEES</span>
        <p>{{ lens.screen.observation?.summary }}</p>
      </div>
      <BridgePairing v-if="lens.session.mode === 'live'" />
    </section>
    <aside class="control-panel">
      <div class="panel-header">
        <h2>
          {{ lens.session.mode === 'demo' ? 'Give Lens a goal' : 'Reviewed desktop actions' }}
        </h2>
        <span class="small-tag">{{ lens.session.mode.toUpperCase() }}</span>
      </div>
      <div v-if="lens.session.mode === 'demo'" class="composer">
        <label for="goal">What would you like to do?</label
        ><textarea id="goal" v-model="goal" rows="3" maxlength="2000" /><button
          v-if="!lens.session.authorized"
          class="button primary full"
          @click="enable"
        >
          <MousePointer2 :size="15" /> Enable demo control</button
        ><button v-else class="button primary full" :disabled="lens.runtimeState.busy" @click="run">
          <Play :size="14" /> Run goal <ArrowUpRight :size="16" />
        </button>
        <p class="control-note">
          {{
            lens.session.authorized
              ? 'Control is limited to this demo desktop.'
              : 'Control starts only after you enable it.'
          }}
        </p>
      </div>
      <div v-else class="composer">
        <p class="live-note">
          Live vision is not configured. Review your shared screen, select a bounded action, and
          approve it before execution.
        </p>
        <label for="manual-tool">Action</label
        ><select id="manual-tool" v-model="manual" @change="example">
          <option
            v-for="tool in lens.tools.definitions.filter((t) => t.name.startsWith('desktop_'))"
            :key="tool.name"
          >
            {{ tool.name }}
          </option></select
        ><label for="manual-input">Action input</label
        ><textarea id="manual-input" v-model="payload" rows="4" spellcheck="false" /><button
          class="button primary full"
          :disabled="!lens.session.authorized || lens.runtimeState.busy"
          @click="act"
        >
          Propose action</button
        ><button class="text-link" @click="enable">Return to demo desktop</button>
      </div>
      <div class="runtime-card" aria-live="polite">
        <div class="eyebrow">RUNTIME / {{ lens.runtimeState.state.replaceAll('_', ' ') }}</div>
        <h3>
          {{
            lens.runtimeState.proposed?.description ??
            (lens.runtimeState.state === 'completed'
              ? 'Every step accounted for.'
              : 'Ready when you are.')
          }}
        </h3>
        <p>
          {{
            lens.runtimeState.policy || 'The next action and its policy decision will appear here.'
          }}
        </p>
        <div v-if="lens.runtimeState.state === 'completed'" class="complete-label">
          <Check :size="15" /> Goal completed
        </div>
        <button v-if="lens.runtimeState.busy" class="text-link" @click="lens.cancelGoal()">
          <CircleStop :size="14" /> Cancel goal
        </button>
      </div>
      <div v-if="lens.approvals.pending" class="approval-card" role="alert">
        <span class="eyebrow">YOUR APPROVAL IS NEEDED</span>
        <h3>{{ lens.approvals.pending.action.description }}</h3>
        <p>{{ lens.approvals.pending.reason }}</p>
        <pre>{{ JSON.stringify(lens.approvals.pending.action, null, 2) }}</pre>
        <div class="approval-actions">
          <button
            class="button primary"
            @click="lens.runtime.approve(lens.approvals.pending!.id, true)"
          >
            Approve action</button
          ><button
            class="button light"
            @click="lens.runtime.approve(lens.approvals.pending!.id, false)"
          >
            Deny
          </button>
        </div>
      </div>
    </aside>
  </div>
  <EventTimeline :events="lens.session.events" />
  <WorkflowPanel />
</template>
