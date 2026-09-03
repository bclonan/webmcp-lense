import { z } from 'zod'
import { cartridgeSchema, keySchema, pointSchema, sequenceSchema } from '@lens/schemas'
import type { ActionRequest } from '@lens/protocol'
import type { LensService } from '../app/LensService'
import { pause } from '../runtime/async'
import { ToolRegistry, type ToolDefinition } from './ToolRegistry'
const empty = z.object({}).strict(),
  text = z.string().min(1).max(2000),
  short = z.string().min(1).max(120)
const accepted = z
  .object({ goalId: z.string(), status: z.literal('accepted'), message: z.string() })
  .strict()
const region = z
  .object({
    id: z.string(),
    role: z.enum(['button', 'input', 'menu', 'canvas', 'dialog', 'text', 'icon', 'unknown']),
    label: z.string(),
    text: z.string(),
    bounds: z
      .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
      .strict(),
    confidence: z.number().min(0).max(1),
    consequential: z.boolean().optional(),
  })
  .strict()
const observation = z
  .object({
    id: z.string(),
    timestamp: z.number(),
    frameSize: z.object({ width: z.number(), height: z.number() }).strict(),
    application: z.string().optional(),
    title: z.string().optional(),
    summary: z.string(),
    regions: z.array(region),
    source: z.enum(['fixture', 'mock', 'real provider', 'unavailable']),
    revision: z.number(),
  })
  .strict()
const status = z
  .object({
    state: z.string(),
    goal: z.object({ id: z.string(), text: z.string() }).strict().nullable(),
    authorized: z.boolean(),
    approvalPending: z.boolean(),
    busy: z.boolean(),
    step: z.number(),
    totalSteps: z.number(),
    failure: z.string(),
    bridge: z.string(),
    sharing: z.boolean(),
    mappingConfirmed: z.boolean(),
  })
  .strict()
export function createTools(lens: LensService): ToolRegistry {
  const propose = (action: ActionRequest, signal?: AbortSignal) => {
    const { goal } = lens.propose(action, signal)
    return {
      goalId: goal.id,
      status: 'accepted',
      message: 'Inspect goal_status and the workspace. ASK actions wait for human approval.',
    }
  }
  const tools: ToolDefinition[] = [
    {
      name: 'desktop_run_sequence',
      description:
        'Run 1 to 20 explicit steps in order. Each step gets a fresh observation, policy check, approval when required, and verification. A failed or denied step stops the sequence without retry. Never run another action while goal_status.busy is true.',
      schema: sequenceSchema,
      output: accepted,
      example: {
        name: 'Demo Notepad sequence',
        steps: [
          { type: 'press', key: 'WIN' },
          { type: 'type', text: 'Notepad' },
          { type: 'press', key: 'ENTER' },
          { type: 'click', targetId: 'visual:editor' },
          { type: 'type', text: 'Hello from Lens.' },
        ],
      },
      handler: (value, signal) => {
        const run = lens.runSequence(value, signal)
        return {
          goalId: run.goal.id,
          status: 'accepted',
          message:
            'Steps run sequentially. Check goal_status for progress and approve each requested action in Lens.',
        }
      },
    },
    {
      name: 'screen_get_context',
      description:
        'Observe the shared screen or demo desktop, including source and current visual regions.',
      schema: empty,
      output: observation,
      example: {},
      readOnly: true,
      handler: () => lens.observe(),
    },
    {
      name: 'screen_locate',
      description: 'Find visible regions by label, text or semantic ID in a fresh observation.',
      schema: z.object({ query: short }).strict(),
      output: z.object({ observationId: z.string(), regions: z.array(region) }).strict(),
      example: { query: 'canvas' },
      readOnly: true,
      handler: async ({ query }) => {
        const o = await lens.observe()
        return {
          observationId: o.id,
          regions: o.regions.filter((r) =>
            `${r.id} ${r.label} ${r.text}`.toLowerCase().includes(query.toLowerCase()),
          ),
        }
      },
    },
    {
      name: 'desktop_click',
      description:
        'Propose a click on a current semantic target or normalized point. Consequential actions require visible human approval.',
      schema: z
        .object({
          targetId: short.optional(),
          point: pointSchema.optional(),
          button: z.enum(['left', 'right']).default('left'),
        })
        .strict()
        .refine((v) => !!v.targetId !== !!v.point, 'Provide exactly one targetId or point.'),
      output: accepted,
      example: { targetId: 'visual:start' },
      handler: (v, s) =>
        propose(
          {
            ...v,
            type: 'pointer.click',
            description: `Click ${v.targetId ?? 'the selected screen point'}`,
          },
          s,
        ),
    },
    {
      name: 'desktop_type',
      description:
        'Propose bounded text entry into the focused field. Does not choose or open another application.',
      schema: z.object({ text }).strict(),
      output: accepted,
      example: { text: 'The house is finished.' },
      handler: (v, s) =>
        propose({ ...v, type: 'keyboard.text', description: 'Enter text in the focused field' }, s),
    },
    {
      name: 'desktop_press',
      description:
        'Propose one allowlisted key or key combination. Save, delete, paste and closing work require review.',
      schema: z.object({ key: keySchema }).strict(),
      output: accepted,
      example: { key: 'WIN' },
      handler: (v, s) => propose({ ...v, type: 'keyboard.key', description: `Press ${v.key}` }, s),
    },
    {
      name: 'desktop_scroll',
      description: 'Propose a bounded vertical scroll at the current pointer position.',
      schema: z.object({ delta: z.number().int().min(-1200).max(1200) }).strict(),
      output: accepted,
      example: { delta: -120 },
      handler: (v, s) =>
        propose({ ...v, type: 'scroll', description: 'Scroll the current view' }, s),
    },
    {
      name: 'desktop_drag',
      description:
        'Propose a bounded mouse path in normalized screen coordinates. Use current screen context to keep it within the intended target.',
      schema: z
        .object({
          points: z.array(pointSchema).min(2).max(128),
          durationMs: z.number().int().min(50).max(5000).default(600),
        })
        .strict(),
      output: accepted,
      example: {
        points: [
          { x: 0.3, y: 0.55 },
          { x: 0.6, y: 0.55 },
        ],
        durationMs: 600,
      },
      handler: (v, s) =>
        propose({ ...v, type: 'pointer.drag', description: 'Draw a bounded pointer path' }, s),
    },
    {
      name: 'screen_wait_for',
      description:
        'Wait at most ten seconds for a phrase in observed state. This does not infer semantics from live pixels without a provider.',
      schema: z
        .object({ text: short, timeoutMs: z.number().int().min(100).max(10000).default(4000) })
        .strict(),
      output: observation,
      example: { text: 'Paint open', timeoutMs: 4000 },
      readOnly: true,
      handler: async (v, s) => {
        const signal = s ?? new AbortController().signal
        const until = Date.now() + v.timeoutMs
        do {
          signal.throwIfAborted()
          const o = await lens.observe()
          if (
            `${o.summary} ${o.regions.map((r) => r.text).join(' ')}`
              .toLowerCase()
              .includes(v.text.toLowerCase())
          )
            return o
          await pause(200, signal)
        } while (Date.now() < until)
        throw new Error(`Timed out waiting for ${v.text}.`)
      },
    },
    {
      name: 'goal_start',
      description:
        'Start a bounded demo goal after the user enables control. Paint, Notepad and fictional claims scenarios use fixture planning.',
      schema: z.object({ goal: text }).strict(),
      output: accepted,
      example: { goal: 'Open Paint and draw a small house with a sun.' },
      handler: ({ goal }, s) => {
        const run = lens.startGoal(goal, undefined, s)
        return {
          goalId: run.goal.id,
          status: 'accepted',
          message:
            'The runtime owns execution. Check goal_status for completion or required approval.',
        }
      },
    },
    {
      name: 'goal_status',
      description:
        'Read current goal progress, control authorization and whether human approval is pending.',
      schema: empty,
      output: status,
      example: {},
      readOnly: true,
      handler: () => ({
        state: lens.runtimeState.state,
        goal: lens.runtimeState.goal,
        authorized: lens.session.authorized,
        approvalPending: !!lens.approvals.pending,
        busy: lens.runtimeState.busy,
        step: lens.runtimeState.step,
        totalSteps: lens.runtimeState.total,
        failure: lens.runtimeState.failure,
        bridge: lens.bridgeState.status,
        sharing: lens.screen.sharing,
        mappingConfirmed: lens.screen.geometry.calibrated,
      }),
    },
    {
      name: 'goal_rerun',
      description:
        'Explicitly rerun the previous goal or sequence from its first step. May duplicate effects. Uses fresh observations and approvals; never resumes automatically after failure.',
      schema: empty,
      output: accepted,
      example: {},
      handler: (_, signal) => {
        const run = lens.rerunLast(signal)
        return {
          goalId: run.goal.id,
          status: 'accepted',
          message: 'Rerunning from the first step with fresh observations and approval checks.',
        }
      },
    },
    {
      name: 'goal_cancel',
      description:
        'Cancel the remaining sequence. Pairing stays active unless a native command is currently executing, which requires an emergency stop.',
      schema: empty,
      output: z.object({ cancelled: z.boolean() }).strict(),
      example: {},
      handler: async () => {
        await lens.cancelGoal()
        return { cancelled: true }
      },
    },
    {
      name: 'session_get_events',
      description:
        'Read a bounded page of this session event log. Raw screenshots are never included. Use the last ID as an after cursor.',
      schema: z
        .object({
          after: z.string().max(64).optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .strict(),
      output: z
        .object({
          events: z.array(
            z
              .object({
                id: z.string(),
                sessionId: z.string(),
                timestamp: z.number(),
                type: z.string(),
                message: z.string(),
              })
              .strict(),
          ),
          nextCursor: z.string().nullable(),
        })
        .strict(),
      example: { limit: 20 },
      readOnly: true,
      handler: ({ after, limit }) => {
        const start = after ? lens.session.events.findIndex((e) => e.id === after) + 1 : 0
        if (after && start === 0) throw new Error('Unknown event cursor.')
        const events = lens.session.events
          .slice(start, start + limit)
          .map(({ id, sessionId, timestamp, type, message }) => ({
            id,
            sessionId,
            timestamp,
            type,
            message,
          }))
        return { events, nextCursor: events.at(-1)?.id ?? null }
      },
    },
    {
      name: 'workflow_start_recording',
      description:
        'Record successful Lens actions and declared notes for a portable workflow. Global OS input is not recorded.',
      schema: empty,
      output: z.object({ recording: z.literal(true) }).strict(),
      example: {},
      handler: () => {
        lens.startRecording()
        return { recording: true }
      },
    },
    {
      name: 'workflow_stop_recording',
      description:
        'Finish a recording after the current goal settles and save its capability cartridge locally.',
      schema: z.object({ name: z.string().min(1).max(100) }).strict(),
      output: cartridgeSchema,
      example: { name: 'My Paint workflow' },
      handler: ({ name }) => lens.stopRecording(name),
    },
    {
      name: 'browser_get_capabilities',
      description:
        "Report this browser's supported screen-sharing and clipboard APIs without requesting permission or reading clipboard contents. Other browser tabs require an extension and are not exposed by Lens.",
      schema: empty,
      example: {},
      readOnly: true,
      output: z
        .object({
          screenSharing: z.boolean(),
          clipboardRead: z.boolean(),
          clipboardWrite: z.boolean(),
          otherBrowserTabs: z.literal(false),
          desktopInput: z.string(),
          permissions: z.string(),
        })
        .strict(),
      handler: () => lens.browser.describe(),
    },
    {
      name: 'browser_clipboard_propose_write',
      description:
        'Propose text to copy to the system clipboard. The visible Copy approved text button performs the write with user activation. This tool never reads or changes the clipboard itself.',
      schema: z.object({ text }).strict(),
      example: { text: 'Hello from Lens.' },
      output: z.object({ proposalId: z.string(), status: z.literal('awaiting_user') }).strict(),
      handler: ({ text }) => lens.browser.proposeCopy(text),
    },
    {
      name: 'capability_export',
      description:
        'Return portable cartridge JSON by ID. This returns data only; a file download requires the visible Export button.',
      schema: z.object({ id: short }).strict(),
      output: cartridgeSchema,
      example: { id: 'lens-claims-v1' },
      readOnly: true,
      handler: ({ id }) => {
        const c = lens.session.cartridges.find((c) => c.id === id)
        if (!c) throw new Error('Cartridge not found.')
        return c
      },
    },
  ]
  return new ToolRegistry(tools)
}
