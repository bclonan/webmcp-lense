<script setup lang="ts">
import {
  ArrowUpRight,
  ArrowRight,
  ScanLine,
  ShieldCheck,
  Route,
  Play,
  Check,
} from 'lucide-vue-next'
import MockDesktop from '../components/MockDesktop.vue'
import { freshDesktop } from '@lens/fixtures'
import { useRouter } from 'vue-router'
import { useLens } from '../app/context'
const router = useRouter(),
  lens = useLens()
async function share() {
  const capture = lens.shareScreen()
  await router.push('/session')
  try {
    await capture
  } catch (e) {
    lens.session.error = String(e)
  }
}
const sample = freshDesktop()
sample.app = 'Paint'
sample.strokes = [
  [
    { x: 0.3, y: 0.55 },
    { x: 0.3, y: 0.77 },
    { x: 0.61, y: 0.77 },
    { x: 0.61, y: 0.55 },
    { x: 0.3, y: 0.55 },
  ],
  [
    { x: 0.26, y: 0.56 },
    { x: 0.455, y: 0.36 },
    { x: 0.65, y: 0.56 },
  ],
  [
    { x: 0.42, y: 0.77 },
    { x: 0.42, y: 0.62 },
    { x: 0.49, y: 0.62 },
    { x: 0.49, y: 0.77 },
  ],
  Array.from({ length: 33 }, (_, i) => ({
    x: 0.75 + 0.065 * Math.cos((i / 32) * Math.PI * 2),
    y: 0.4 + 0.08 * Math.sin((i / 32) * Math.PI * 2),
  })),
]
</script>
<template>
  <section class="home-hero">
    <div class="hero-copy">
      <div class="eyebrow"><span class="mini-line" /> THE INTERFACE IS ALREADY THERE</div>
      <h1>Turn any screen into an <span>agent-addressable</span> interface.</h1>
      <p>
        Give an agent a view of your screen. Watch it find its way, propose the next step, and act
        with your permission.
      </p>
      <div class="hero-actions">
        <button class="button primary" @click="share">
          Share Your Screen <ArrowUpRight :size="17" /></button
        ><RouterLink to="/demo" class="button light"><Play :size="15" /> Run Demo</RouterLink>
      </div>
      <div class="hero-note">
        <ShieldCheck :size="15" /> Runs locally. You decide when control starts and stops.
      </div>
    </div>
    <div class="hero-visual">
      <div class="preview-top">
        <span><i /> A LITTLE DEMONSTRATION</span><span>01 / PAINT</span>
      </div>
      <MockDesktop :desktop="sample" decorative />
      <div class="hero-target"><ScanLine :size="16" /> Drawing canvas <span>located</span></div>
      <div class="hero-receipt">
        <span class="receipt-check"><Check :size="17" /></span>
        <div>
          <strong>A house, drawn from a goal.</strong
          ><span>4 mouse paths · Every step observed</span>
        </div>
        <ArrowUpRight :size="19" />
      </div>
      <div class="preview-caption">
        Deterministic demo preview. No model or desktop access required.
      </div>
    </div>
  </section>
  <section class="process-section">
    <div class="section-intro">
      <span class="eyebrow">A VISIBLE LOOP</span>
      <h2>Less mystery.<br />More knowing what happened.</h2>
      <RouterLink to="/demo" class="text-link"
        >See it in action <ArrowRight :size="15"
      /></RouterLink>
    </div>
    <div class="process-item">
      <span class="process-number">01</span><ScanLine />
      <h3>See the screen</h3>
      <p>Share a window or try the demo desktop. Visual regions show what Lens recognizes.</p>
    </div>
    <div class="process-item">
      <span class="process-number">02</span><Route />
      <h3>Follow the intention</h3>
      <p>Inspect the next action and its policy decision. Approve the steps that need you.</p>
    </div>
    <div class="process-item">
      <span class="process-number">03</span><ShieldCheck />
      <h3>Check the result</h3>
      <p>Each action leaves a receipt. Screen changes and assertions show whether it worked.</p>
    </div>
  </section>
</template>
