<script setup lang="ts">
import { computed } from 'vue'
import {
  Paintbrush,
  FileText,
  FolderClosed,
  Search,
  Grid2X2,
  Minus,
  Square,
  X,
  MousePointer2,
} from 'lucide-vue-next'
import type { MockDesktop as Desktop } from '@lens/fixtures'
import type { VisualRegion } from '@lens/protocol'
const props = defineProps<{
  desktop: Desktop
  regions?: VisualRegion[]
  targetId?: string
  showRegions?: boolean
  decorative?: boolean
}>()
const paths = computed(() =>
  props.desktop.strokes.map((stroke) =>
    stroke.map((p, i) => `${i ? 'L' : 'M'} ${p.x * 1000} ${p.y * 700}`).join(' '),
  ),
)
</script>
<template>
  <div
    class="mock-desktop"
    :class="{ decorative }"
    role="img"
    :aria-label="`${desktop.app} demo desktop`"
  >
    <div class="wallpaper-orbit orbit-one" />
    <div class="wallpaper-orbit orbit-two" />
    <div v-if="desktop.app === 'desktop' && !desktop.searchOpen" class="desktop-icons">
      <div><Paintbrush /><span>Paint</span></div>
      <div><FileText /><span>Notepad</span></div>
      <div><FolderClosed /><span>Claims Manager</span></div>
    </div>
    <div v-if="desktop.app !== 'desktop' && !desktop.searchOpen" class="mock-window">
      <div class="window-title">
        <span class="window-app"
          ><Paintbrush v-if="desktop.app === 'Paint'" :size="14" /><FileText v-else :size="14" />
          {{ desktop.app }}</span
        ><span class="window-controls"><Minus /><Square /><X /></span>
      </div>
      <div class="window-toolbar">
        <span>File</span><span>Edit</span><span>View</span><span class="toolbar-fill" /><span
          v-if="desktop.app !== 'Legacy Claims Manager'"
          >Save</span
        >
      </div>
      <div v-if="desktop.app === 'Paint'" class="paint-palette">
        <span class="palette-tool">✎</span
        ><i
          v-for="color in ['#22392f', '#d47b54', '#e6b450', '#759eaa', '#8a80a7']"
          :key="color"
          :style="{ background: color }"
        /><span class="dim">Brush · 4 px</span>
      </div>
    </div>
    <div v-if="desktop.app === 'Paint' && !desktop.searchOpen" class="paint-paper" />
    <svg
      v-if="desktop.app === 'Paint' && !desktop.searchOpen"
      class="drawing-layer"
      viewBox="0 0 1000 700"
    >
      <path
        v-for="(path, i) in paths"
        :key="i"
        :d="path"
        :stroke="i === 3 ? '#d69c3a' : '#355845'"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <div v-if="desktop.app === 'Notepad' && !desktop.searchOpen" class="notepad-paper">
      {{ desktop.text }}<span class="text-caret" />
    </div>
    <div v-if="desktop.app === 'Legacy Claims Manager' && !desktop.searchOpen" class="claims-body">
      <span class="eyebrow">CLAIMS / NEW ENTRY</span>
      <h3>Review a claim</h3>
      <label>Claim number</label>
      <div class="claim-input">{{ desktop.claimNumber || 'Enter claim number' }}</div>
      <p class="claim-status" :class="{ submitted: desktop.submitted }">
        {{ desktop.submitted ? 'Claim submitted' : 'Draft, awaiting review' }}
      </p>
      <div class="claim-submit">Submit claim →</div>
      <small>Fictional application · No real claims</small>
    </div>
    <div v-if="desktop.searchOpen" class="start-menu">
      <div class="mock-search">
        <Search :size="16" />{{ desktop.search || 'Search applications'
        }}<span class="text-caret" />
      </div>
      <small>BEST MATCH</small>
      <div class="search-result">
        <Paintbrush v-if="desktop.search.includes('Paint')" /><FileText v-else /><span
          >{{ desktop.search || 'Your apps, one search away' }}<small>Application</small></span
        ><span>↵</span>
      </div>
    </div>
    <div class="taskbar">
      <Grid2X2 :size="19" />
      <div class="taskbar-search"><Search :size="13" /> Search</div>
      <Paintbrush :size="17" /><FileText :size="17" /><span class="toolbar-fill" /><span
        class="taskbar-clock"
        >LENS DEMO</span
      >
    </div>
    <div v-if="showRegions" class="regions-layer">
      <div
        v-for="region in regions"
        :key="region.id"
        class="visual-region"
        :class="{ targeted: region.id === targetId }"
        :style="{
          left: `${region.bounds.x * 100}%`,
          top: `${region.bounds.y * 100}%`,
          width: `${region.bounds.width * 100}%`,
          height: `${region.bounds.height * 100}%`,
        }"
      >
        <span
          >{{ region.role }}<b>{{ region.label }}</b></span
        >
      </div>
    </div>
    <MousePointer2
      v-if="!decorative"
      class="demo-pointer"
      :style="{ left: `${desktop.pointer.x * 100}%`, top: `${desktop.pointer.y * 100}%` }"
      :size="20"
      fill="#fff"
    />
  </div>
</template>
