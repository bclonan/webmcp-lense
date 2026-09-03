<script setup lang="ts">
import { computed } from 'vue'
import { useLens } from '../app/context'
import project from '../content/project.json'
import script from '../content/demo-video-script.json'
import { youtubeEmbed } from '../content/video'
import { workflows } from '../content/workflows'
import CopyButton from '../components/CopyButton.vue'
import VideoPreview from '../components/VideoPreview.vue'
import licenseText from '../../../../LICENSE?raw'
const lens = useLens()
const video = computed(() => youtubeEmbed(project.youtubeUrl))
const architecture = [
  ['User request', 'A person states the goal and enables the appropriate control.'],
  [
    'WebMCP discovery',
    'nativeAdapter registers the canonical tool definitions with document.modelContext.',
  ],
  ['Validated call', 'ToolRegistry validates arguments with Zod and exposes their JSON Schemas.'],
  [
    'Application service',
    'LensService routes the request through ComputerRuntime and PolicyEngine.',
  ],
  [
    'Shared state',
    'Pinia stores the goal, observations and approvals. Repository persists events and workflows in IndexedDB.',
  ],
  ['Visible update', 'Vue renders progress, the shared view and any approval card in Workspace.'],
  [
    'Structured result',
    'The tool returns a validated envelope; goal_status reports asynchronous completion or failure.',
  ],
]
const showcases = [
  {
    title: 'A goal becomes a visible result',
    goal: 'Draw a house and sun.',
    human: 'Enable demo control and watch the canvas.',
    chain: 'goal_start → goal_status → screen_get_context',
    outcome: 'Four paths appear in Paint with a completed runtime and event trail.',
    prompt: workflows[0].prompt,
  },
  {
    title: 'A person owns the final decision',
    goal: 'Prepare fictional claim CLM-2048.',
    human: 'Review the draft and approve or deny its final submission.',
    chain: 'goal_start → goal_status → session_get_events',
    outcome: 'The draft waits at an approval card. Denial stops the sequence.',
    prompt: workflows[2].prompt,
  },
  {
    title: 'Teach a repeatable workflow',
    goal: 'Reuse a successful Notepad run.',
    human: 'Enable the demo, request recording, inspect or edit the saved workflow, choose Export.',
    chain:
      'workflow_start_recording → desktop_run_sequence → workflow_stop_recording → capability_export',
    outcome: 'A validated cartridge appears in Workspace and IndexedDB.',
    prompt: workflows[1].prompt,
  },
  {
    title: 'Keep clipboard changes explicit',
    goal: 'Copy a short verified summary.',
    human: 'Review the proposed text and click Copy approved text.',
    chain: 'browser_get_capabilities → session_get_events → browser_clipboard_propose_write',
    outcome: 'The proposal remains pending until the person chooses to copy.',
    prompt: workflows[3].prompt,
  },
  {
    title: 'Connect your own screen',
    goal: 'Send a bounded action to a desktop application.',
    human:
      'Share a monitor, download the optional bridge, pair, confirm bounds, approve each native action.',
    chain: 'screen_get_context → desktop_run_sequence → goal_status',
    outcome: 'Reviewed input and observed pixel changes. Live semantic vision is not configured.',
    prompt:
      'Read browser_get_capabilities and goal_status in Lens. Wait for me to complete Desktop setup and confirm the monitor. Help me prepare a bounded sequence, explain each action, and pause for its visible approval. Do not infer live semantic success from pixels alone.',
  },
]
const comparisons = [
  {
    goal: 'Run a demo goal',
    manual: 'Type the goal, press Run, watch the canvas.',
    screen: 'Find the composer and button, fill them, infer progress from the layout.',
    webmcp: 'Call goal_start, then read goal_status and the observation.',
    benefit:
      'The requested goal has an ID and a structured status. UI layout changes need not alter the tool call.',
  },
  {
    goal: 'Save a reusable workflow',
    manual: 'Record, run actions, name the workflow and inspect its JSON.',
    screen: 'Locate recording and save controls and extract the resulting identifier.',
    webmcp: 'Use recording tools; pass the returned cartridge ID to capability_export.',
    benefit:
      'Validated data connects the steps. The person still decides whether to download or rerun.',
  },
  {
    goal: 'Recover from an uncertain action',
    manual: 'Read the timeline and inspect the target before trying again.',
    screen: 'Guess whether input landed from a changed screenshot.',
    webmcp:
      'Read goal_status, session_get_events and screen_get_context before requesting a rerun.',
    benefit:
      'Failures stop the sequence. Explicit rerun uses new approvals and IDs; it can still duplicate earlier effects.',
  },
]
const checklist = computed(() => [
  { label: 'Working public live URL', done: true, detail: project.liveUrl },
  {
    label: 'Project description and WebMCP fit',
    done: true,
    detail:
      'Problem, users, shared workflow, UX improvement and implementation are documented on this page.',
  },
  {
    label: 'Human and agent collaboration',
    done: true,
    detail: 'Visible enablement, pairing, approvals, export and stop boundaries are described.',
  },
  {
    label: 'Public source repository',
    done: project.repositoryPublic,
    detail: `GitHub visibility verified ${project.repositoryVerifiedAt}. ${project.repositoryUrl}`,
  },
  {
    label: 'Complete source, assets and setup instructions',
    done: false,
    detail:
      'New documentation and branding are present in the working tree. Publish these source changes before submission.',
  },
  {
    label: 'Visible OSI-approved license',
    done: project.licensePublishedToRepository,
    detail:
      'MIT license added in this update and shown below. Publish LICENSE to the source repository before submission.',
  },
  {
    label: 'README and contributor commands',
    done: true,
    detail:
      'Local README includes install, development, test, build, deployment and tool-development instructions.',
  },
  {
    label: 'Public YouTube demo under 3 minutes with audio',
    done: false,
    detail: video.value
      ? 'Video configured. Verify public visibility, duration and audio before marking complete.'
      : '[YOUTUBE_URL] · Record the 2:50 script below, upload publicly and configure its URL.',
  },
])
const commands =
  'pnpm install --frozen-lockfile\npnpm dev\npnpm typecheck\npnpm test\npnpm test:e2e\npnpm build\npnpm test:bridge\nnetlify deploy --filter @lens/web --site 11208571-39b6-465e-981e-8cd12e0e4f43 --prod --no-build'
</script>
<template>
  <div class="docs-page hackathon-page">
    <header class="docs-hero docs-two">
      <div>
        <span class="eyebrow">LENS / HACKATHON OVERVIEW</span>
        <h1>Your screen.<br />Your next move.</h1>
        <p>{{ project.description }}</p>
        <p class="docs-tagline">WebMCP gives the agent a contract. You keep the controls.</p>
        <div class="docs-actions">
          <RouterLink to="/demo" class="button primary">Launch demo</RouterLink
          ><RouterLink to="/webmcp" class="text-link">Explore WebMCP tools</RouterLink
          ><a :href="project.repositoryUrl" target="_blank" rel="noreferrer" class="text-link"
            >Git repository</a
          ><a
            v-if="video"
            :href="project.youtubeUrl"
            target="_blank"
            rel="noreferrer"
            class="text-link"
            >Watch demo video</a
          ><a v-else href="#video" class="text-link">Demo video · coming soon</a>
        </div>
      </div>
      <img
        class="docs-brand-preview"
        src="/og-image.png"
        alt="Lens. See, act and verify with shared tools and human control."
        width="1200"
        height="630"
      />
    </header>
    <nav class="docs-nav" aria-label="Hackathon overview sections">
      <a href="#project">The project</a><a href="#architecture">How it works</a
      ><a href="#showcase">Features</a><a href="#extend">Extend it</a
      ><a href="#submission">Submission</a><a href="#video">Video plan</a>
    </nav>
    <section id="project" class="docs-section">
      <span class="eyebrow">A THREE-MINUTE TOUR</span>
      <h2>Automation you can inspect while it runs</h2>
      <p>
        People working across desktop applications need help with repeated actions, but they also
        need to know what an agent is about to do. Lens is for those people and for developers
        exploring browser-agent collaboration. Start with a deterministic demo, give it a goal,
        review any approval, and inspect the result in the same workspace.
      </p>
      <div class="docs-two">
        <article class="docs-card">
          <h3>The person controls the session</h3>
          <p>
            Choose the screen, pair the optional desktop companion, confirm the monitor, and approve
            native actions. STOP revokes control. New session clears the current workspace while
            retaining saved workflows and history.
          </p>
        </article>
        <article class="docs-card docs-tint">
          <h3>The agent has declared tools</h3>
          <p>
            {{ lens.tools.definitions.length }} tools expose observations, bounded actions, runtime
            status, recordings and exports. They call the same service as the buttons. An approval
            card is shared state, not a separate agent permission channel.
          </p>
        </article>
      </div>
      <p>
        Without declared tools, an agent must locate Lens controls and infer their meaning. WebMCP
        provides typed requests and explicit results. It does not replace observation of the target
        desktop. Demo semantics are fixture-backed; live input verifies pixel change and still
        requires human review.
      </p>
    </section>
    <section id="architecture" class="docs-section">
      <h2>One runtime behind both interfaces</h2>
      <ol class="docs-architecture" aria-label="Lens request and result architecture">
        <li v-for="(node, index) in architecture" :key="node[0]">
          <span class="docs-step-number">{{ index + 1 }}</span>
          <div>
            <h3>{{ node[0] }}</h3>
            <p>{{ node[1] }}</p>
          </div>
          <span v-if="index < architecture.length - 1" aria-hidden="true" class="docs-arrow"
            >↓</span
          >
        </li>
      </ol>
      <p>
        Vue 3 and Vue Router render the app. Pinia holds reactive state; the
        <code>Repository</code> adapter owns IndexedDB. <code>MockDesktopBridge</code> powers
        reproducible demos. <code>LocalDesktopBridge</code> talks to the optional Rust companion
        over loopback. Netlify serves the static browser build. No remote model, telemetry service
        or hosted native-input server is bundled.
      </p>
      <details>
        <summary>WebMCP implementation details</summary>
        <p>
          Lens uses imperative JavaScript registration, not HTML form annotations. Names such as
          <code>screen_get_context</code> and <code>desktop_run_sequence</code> identify bounded
          capabilities. The shared registry exports JSON Schema from strict Zod schemas and
          validates both input and successful output data.
        </p>
        <p>
          <code>nativeAdapter.ts</code> sets <code>readOnlyHint</code> and
          <code>untrustedContentHint</code>. Tool invocation calls <code>LensService</code>, whose
          stores update the same Vue components. Results use <code>{ ok, data }</code> or
          <code>{ ok: false, error: { code, message } }</code>. Accepted goals remain asynchronous;
          the agent checks status and events.
        </p>
        <p>
          AbortSignals cancel calls and registrations. Registration failure aborts the batch and
          keeps local tools available. The shell registers once, retains tools during route changes,
          and cleans up on document unload or hot reload. A tool cannot capture a screen, pair a
          bridge, authorize control or approve its own action.
        </p>
      </details>
    </section>
    <section id="showcase" class="docs-section">
      <h2>What you can demonstrate</h2>
      <div class="docs-two">
        <article v-for="feature in showcases" :key="feature.title" class="docs-card">
          <h3>{{ feature.title }}</h3>
          <p><b>Goal.</b> {{ feature.goal }}</p>
          <p><b>Person.</b> {{ feature.human }}</p>
          <p>
            <b>Tools.</b> <code>{{ feature.chain }}</code>
          </p>
          <p><b>Visible result.</b> {{ feature.outcome }}</p>
          <details>
            <summary>Demonstration prompt</summary>
            <p>{{ feature.prompt }}</p>
            <CopyButton :text="feature.prompt" />
          </details>
        </article>
      </div>
    </section>
    <section class="docs-section">
      <h2>Three everyday differences</h2>
      <article v-for="item in comparisons" :key="item.goal" class="docs-card">
        <h3>{{ item.goal }}</h3>
        <div class="docs-three">
          <p><b>Manual workflow.</b> {{ item.manual }}</p>
          <p><b>Screenshot or DOM agent.</b> {{ item.screen }}</p>
          <p><b>WebMCP workflow.</b> {{ item.webmcp }}</p>
        </div>
        <p>{{ item.benefit }}</p>
      </article>
    </section>
    <section class="docs-section docs-owner">
      <span class="eyebrow">FROM THE PROJECT OWNER</span>
      <h2>What this makes possible</h2>
      <p>
        I can put a person and an agent in one workspace without giving them different versions of
        the truth. I can record a successful run, inspect its steps, and reuse it through the same
        approval policy. I can also stop a failed sequence and show exactly where it stopped.
      </p>
      <p>
        I want to extend that contract to better vision providers and useful application workflows.
        I will still distinguish an input receipt from a verified outcome. That distinction is the
        reason Lens has a timeline, not just a Run button.
      </p>
    </section>
    <section id="extend" class="docs-section">
      <h2>Extend the existing contracts</h2>
      <ol class="docs-contribute">
        <li>
          <b>Add the service operation.</b> Keep application behavior in
          <code>apps/web/src/app/LensService.ts</code> or an existing bridge, vision or persistence
          adapter. Call it from UI and tools. Put future providers behind
          <code>vision/VisionProvider.ts</code>; do not add provider calls to components.
        </li>
        <li>
          <b>Define the tool and schema.</b> Add to <code>apps/web/src/webmcp/tools.ts</code> with a
          strict input schema, output schema, representative arguments, read-only hint and handler.
          Reusable protocol shapes belong in <code>packages/schemas/src/index.ts</code>.
        </li>
        <li>
          <b>Explain its use.</b> The catalog automatically includes every registered definition.
          Add curated purpose, result and recovery notes to <code>content/toolDocs.ts</code>.
          Default prompts derive from the canonical name and example.
        </li>
        <li>
          <b>Add a workflow.</b> Add ordered tool names, result dependencies, approval boundaries
          and failure instructions to <code>content/workflows.ts</code>. Every chain reference is
          checked against the real registry.
        </li>
        <li>
          <b>Test before exposing it.</b> Add handler tests under <code>apps/web/tests</code>,
          browser tests under <code>tests/e2e</code>, and input/output examples that pass the
          documentation contract test. Export shared protocol schemas with
          <code>pnpm export:schemas</code>.
        </li>
      </ol>
      <details>
        <summary>Install, develop, test and deploy</summary>
        <p>
          Node.js 22.12+ and pnpm 11.8. Browser demos need no environment variables or API key.
          Install Chromium for browser tests with
          <code>pnpm --filter @lens/web exec playwright install chromium</code>. Rust and platform
          dependencies are needed only for the optional companion.
        </p>
        <pre>{{ commands }}</pre>
        <CopyButton :text="commands" label="Copy commands" />
        <p>
          The native preview binary is ignored by Git. Restage the built download before deploying
          from a fresh checkout, following <code>docs/DEPLOYMENT.md</code>. Existing Netlify
          configuration serves direct routes through the SPA rewrite.
        </p>
      </details>
    </section>
    <section id="submission" class="docs-section docs-submission">
      <span class="eyebrow">SUBMISSION READINESS</span>
      <h2>Evidence, with the gaps visible</h2>
      <p>
        This follows the requested submission checklist. No event, deadline or event-specific
        eligibility has been inferred. A configured URL is not proof that its video meets the
        duration and audio requirements.
      </p>
      <ul class="docs-checklist">
        <li v-for="item in checklist" :key="item.label">
          <span :class="['docs-badge', { pending: !item.done }]">{{
            item.done ? 'Ready' : 'Pending'
          }}</span>
          <div>
            <h3>{{ item.label }}</h3>
            <p>{{ item.detail }}</p>
          </div>
        </li>
      </ul>
      <details>
        <summary>MIT license</summary>
        <p>
          No license existed at the start of this update. MIT is an
          <a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer"
            >OSI-approved license</a
          >. Existing dependency licenses remain applicable.
        </p>
        <pre>{{ licenseText }}</pre>
      </details>
      <p>
        Configuration lives in <code>apps/web/src/content/project.json</code>. Missing URLs use
        <code>[LIVE_URL]</code>, <code>[REPOSITORY_URL]</code> or <code>[YOUTUBE_URL]</code>. The
        live and repository URLs above were verified; the video is the remaining URL placeholder.
      </p>
    </section>
    <section id="video" class="docs-section">
      <span class="eyebrow">2 MINUTES, 50 SECONDS</span>
      <h2>The recording plan</h2>
      <VideoPreview :url="project.youtubeUrl" />
      <p>
        Record at roughly 130–150 spoken words per minute. Keep the primary workflow uninterrupted.
        The script and the page share one source in <code>content/demo-video-script.json</code>; the
        Markdown copy is <code>docs/demo-video-script.md</code>.
      </p>
      <details v-for="segment in script" :key="segment.time" class="docs-card">
        <summary>{{ segment.time }} · {{ segment.title }}</summary>
        <p><b>Screen action.</b> {{ segment.action }}</p>
        <blockquote>{{ segment.narration }}</blockquote>
        <p><b>Tools.</b> {{ segment.tools.join(', ') || 'No tool call in this segment.' }}</p>
        <p><b>Expected result.</b> {{ segment.result }}</p>
        <CopyButton :text="segment.narration" label="Copy narration" />
      </details>
    </section>
  </div>
</template>
