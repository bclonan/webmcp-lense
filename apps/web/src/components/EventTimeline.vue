<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RuntimeEvent } from '@lens/protocol'
const props = defineProps<{ events: RuntimeEvent[] }>()
const detail = ref(false)
const visible = computed(() =>
  props.events
    .filter((e) => detail.value || !['runtime.transition', 'screen.observed'].includes(e.type))
    .slice(-80)
    .reverse(),
)
</script>
<template>
  <section class="timeline">
    <div class="panel-header">
      <h2>
        Event timeline <span>{{ events.length }}</span>
      </h2>
      <label class="toggle-label"><input v-model="detail" type="checkbox" /> All transitions</label>
    </div>
    <div class="timeline-list" aria-live="polite">
      <p v-if="!visible.length" class="empty-state">
        Start a goal. Its actions and results will appear here.
      </p>
      <details
        v-for="event in visible"
        :key="event.id"
        class="event-row"
        :class="{
          'event-success': ['goal.completed', 'action.verified'].includes(event.type),
          'event-warning': ['approval.requested', 'goal.failed', 'control.stopped'].includes(
            event.type,
          ),
        }"
      >
        <summary>
          <span class="event-dot" /><time>{{
            new Date(event.timestamp).toLocaleTimeString([], { hour12: false })
          }}</time
          ><span class="event-type">{{ event.type }}</span
          ><span class="event-message">{{ event.message }}</span>
        </summary>
        <pre>{{
          JSON.stringify(event.data ?? { id: event.id, sessionId: event.sessionId }, null, 2)
        }}</pre>
      </details>
    </div>
  </section>
</template>
