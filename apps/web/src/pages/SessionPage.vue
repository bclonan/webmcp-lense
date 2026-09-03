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
  Plus,
} from 'lucide-vue-next'
import { useLens } from '../app/context'
import MockDesktop from '../components/MockDesktop.vue'
import EventTimeline from '../components/EventTimeline.vue'
import LiveScreen from '../components/LiveScreen.vue'
import BridgePairing from '../components/BridgePairing.vue'
import WorkflowPanel from '../components/WorkflowPanel.vue'
import ActionComposer from '../components/ActionComposer.vue'
import ClipboardPanel from '../components/ClipboardPanel.vue'
import WorkspaceTools from '../components/WorkspaceTools.vue'
import BridgeDownloadLink from '../components/BridgeDownloadLink.vue'
const lens = useLens(),
  goal = ref('Open Paint and draw a small house with a sun.')
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
function rerun() {
  try {
    lens.rerunLast()
  } catch (e) {
    lens.session.error = String(e)
  }
}
function dismissError() {
  lens.session.error = ''
  lens.bridgeState.error = ''
}
async function newSession() {
  try {
    await lens.newSession()
  } catch (error) {
    lens.session.error = error instanceof Error ? error.message : String(error)
  }
}
</script>
<template>
  <section class="workspace-heading">
    <div>
      <div class="eyebrow">YOUR WORKSPACE</div>
      <h1>See. Act. Verify.</h1>
    </div>
    <div class="workspace-actions">
      <button
        class="text-link"
        :disabled="
          lens.session.resetting ||
          lens.session.recording ||
          lens.bridgeState.status === 'connecting'
        "
        :title="
          lens.session.recording
            ? 'Finish saving the recording before starting a new session.'
            : 'Start fresh. Ends sharing and pairing; saved workflows and session history stay.'
        "
        @click="newSession"
      >
        <Plus :size="14" /> {{ lens.session.resetting ? 'Starting session…' : 'New session' }}
      </button>
      <button class="text-link" :disabled="lens.runtimeState.busy" @click="lens.requestSetup()">
        <Monitor :size="14" /> Desktop setup</button
      ><BridgeDownloadLink /><RouterLink to="/demo" class="text-link"
        >Choose a demo <ArrowUpRight :size="15"
      /></RouterLink>
    </div>
  </section>
  <p v-if="lens.session.fresh" class="notice" role="status">
    New session ready. Choose a demo or connect your desktop. Saved workflows and session history
    are still available.
  </p>
  <p v-if="lens.session.recording" class="control-note">
    Finish saving your recording to start a new session.
  </p>
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
  <div class="workspace-grid workspace-with-tools">
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
      <template v-else
        ><ActionComposer /><button
          class="text-link return-demo"
          :disabled="lens.runtimeState.busy"
          @click="enable"
        >
          Return to demo desktop
        </button></template
      >
      <div class="runtime-card" aria-live="polite">
        <div class="eyebrow">RUNTIME / {{ lens.runtimeState.state.replaceAll('_', ' ') }}</div>
        <p v-if="lens.runtimeState.total" class="sequence-progress">
          Step {{ lens.runtimeState.step }} of {{ lens.runtimeState.total }}
        </p>
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
        <p v-if="lens.runtimeState.failure" role="alert" class="inline-error">
          {{ lens.runtimeState.failure }}
          {{
            lens.session.authorized
              ? 'The sequence stopped. Pairing is still active. Check the screen before starting another run.'
              : 'Reconnect from Desktop setup before trying again.'
          }}
        </p>
        <details
          v-if="!lens.runtimeState.busy && lens.runtimeState.lastRun?.mode === lens.session.mode"
          class="rerun-control"
        >
          <summary>Run again</summary>
          <p>
            This starts the previous run from step 1. Text entry and other effects may repeat. Check
            the current screen first.
          </p>
          <button class="button light" @click="rerun">Rerun from first step</button>
        </details>
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
    <aside class="workspace-inspector" aria-label="Tools and timeline">
      <WorkspaceTools />
      <EventTimeline :events="lens.session.events" />
    </aside>
  </div>
  <ClipboardPanel />
  <WorkflowPanel />
</template>
