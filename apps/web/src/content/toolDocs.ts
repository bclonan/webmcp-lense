import type { ToolRegistry } from '../webmcp/ToolRegistry'
import { starterCartridge } from '../workflows/CartridgeService'

type Notes = { title?: string; state: string; recovery: string; prompt?: string; result?: unknown }
const observation = {
  id: 'example-observation',
  timestamp: 1788408000000,
  frameSize: { width: 1001, height: 701 },
  application: 'desktop',
  summary: 'Desktop ready. Paint, Notepad and Legacy Claims Manager are available.',
  regions: [],
  source: 'fixture',
  revision: 0,
}
const accepted = {
  goalId: 'example-goal',
  status: 'accepted',
  message: 'Check goal_status and review any pending approval in Workspace.',
}
// These are editorial notes, not tool definitions. Catalog membership, schemas,
// arguments, descriptions and read-only hints come from the runtime registry.
const notes: Record<string, Notes> = {
  desktop_run_sequence: {
    title: 'Run ordered actions',
    state: 'Runtime goal, progress, approvals, desktop and event timeline.',
    recovery:
      'Wait while busy. On a failed step, inspect the screen and history before proposing a fresh sequence.',
    prompt:
      'After I enable the demo, use desktop_run_sequence to open Notepad and type Hello from Lens. Check goal_status between runs and pause for my approvals.',
  },
  screen_get_context: {
    title: 'Observe the screen',
    state: 'Refreshes the observation and appends an observation event; sends no input.',
    recovery:
      'If source is unavailable, ask me to share a screen. Live semantic regions need a configured vision provider.',
    result: observation,
    prompt:
      'Use screen_get_context to describe the current Lens observation and its source. Do not send any desktop input.',
  },
  screen_locate: {
    title: 'Find a visible region',
    state: 'Refreshes observation and timeline; returns matching current regions.',
    recovery:
      'An empty list is a valid result. Refresh context and use a visible label; do not reuse stale region IDs.',
    result: { observationId: 'example-observation', regions: [] },
  },
  desktop_click: {
    title: 'Propose a click',
    state: 'Starts a reviewed runtime goal; may change the desktop after approval.',
    recovery:
      'Supply exactly one current targetId or point. If the screen changes during approval, observe and propose again.',
  },
  desktop_type: {
    title: 'Enter bounded text',
    state: 'A reviewed goal and, after approval, the target field.',
    recovery:
      'Focus the intended app during the live keyboard countdown. Never repeat uncertain text entry without inspection.',
  },
  desktop_press: {
    title: 'Press a supported key',
    state: 'Runtime and target application. Save, paste, delete or close may affect existing work.',
    recovery:
      'Choose a key advertised by the companion. Review consequential shortcuts in Workspace.',
  },
  desktop_scroll: {
    title: 'Scroll the current view',
    state: 'Runtime, viewport and observation timeline.',
    recovery:
      'Use a delta from -1200 to 1200. Inspect a failed visual-change check before sending another scroll.',
  },
  desktop_drag: {
    title: 'Draw a pointer path',
    state: 'Runtime and target canvas or application after approval.',
    recovery:
      'Provide 2 to 128 normalized points inside the confirmed shared monitor. Reconfirm mapping after display changes.',
  },
  screen_wait_for: {
    title: 'Wait for observed text',
    state: 'Refreshes observations and timeline during a bounded wait.',
    recovery:
      'A timeout is not completion. Read fresh context; live pixel changes cannot establish semantic text without a provider.',
    result: { ...observation, application: 'Paint', summary: 'Paint open. Canvas is empty.' },
  },
  goal_start: {
    title: 'Start a demo goal',
    state: 'Demo runtime, desktop, progress and timeline.',
    recovery:
      'Enable demo control first. Only supported fixture goals are planned; live actions need explicit steps.',
    prompt:
      'After I enable demo control, call goal_start with Open Paint and draw a small house with a sun. Use goal_status to report the result; acceptance alone is not completion.',
  },
  goal_status: {
    title: 'Inspect goal progress',
    state: 'No state change. Reads the current runtime and connection.',
    recovery:
      'If busy, wait. If approvalPending, bring me to Workspace. If failed, inspect session_get_events before retrying.',
    result: {
      state: 'idle',
      goal: null,
      authorized: false,
      approvalPending: false,
      busy: false,
      step: 0,
      totalSteps: 0,
      failure: '',
      bridge: 'disconnected',
      sharing: false,
      mappingConfirmed: true,
    },
  },
  goal_rerun: {
    title: 'Rerun from the beginning',
    state: 'Creates a fresh goal and command IDs; prior effects may repeat.',
    recovery:
      'Requires a previous run on the same desktop. Ask me before rerunning and inspect existing effects first.',
  },
  goal_cancel: {
    title: 'Cancel remaining work',
    state:
      'Cancels the runtime and pending approval. During native execution it also revokes input.',
    recovery:
      'Inspect goal_status and the target app. Cancellation cannot undo a command already delivered.',
    result: { cancelled: true },
  },
  session_get_events: {
    title: 'Read the event timeline',
    state: 'No state change. Reads bounded event summaries from this session.',
    recovery:
      'For an unknown cursor, restart without after. Use nextCursor only within the same session.',
    result: { events: [], nextCursor: null },
  },
  workflow_start_recording: {
    title: 'Record Lens actions',
    state: 'Starts an in-memory workflow recording of successful Lens actions.',
    recovery:
      'Finish an active recording before starting another. It does not record global mouse or keyboard input.',
    result: { recording: true },
  },
  workflow_stop_recording: {
    title: 'Save a recorded workflow',
    state: 'Stops recording, validates the cartridge and saves it in IndexedDB.',
    recovery:
      'Wait until the goal settles. Record at least one successful action. Check the storage warning if persistence fails.',
    result: {
      version: 1,
      id: 'example-recording',
      name: 'My Paint workflow',
      description: 'Recorded Lens actions. Review each step before replay.',
      application: 'Paint',
      inputs: {},
      steps: [
        {
          type: 'drag',
          points: [
            { x: 0.3, y: 0.55 },
            { x: 0.6, y: 0.55 },
          ],
          durationMs: 600,
        },
      ],
      assertions: [],
      approvalRequirements: [],
      metadata: {
        createdAt: 1788408000000,
        observationSource: 'fixture',
        author: 'Local user',
        notes: [],
      },
    },
  },
  browser_get_capabilities: {
    title: 'Inspect browser support',
    state: 'No state change, permission requests or clipboard reads.',
    recovery:
      'Unsupported APIs remain unavailable. Use browser demos when capture or local-network access is blocked.',
    result: {
      screenSharing: true,
      clipboardRead: true,
      clipboardWrite: true,
      otherBrowserTabs: false,
      desktopInput: 'Requires the paired local bridge',
      permissions:
        'Screen sharing and clipboard operations require a visible user action and browser permission.',
    },
  },
  browser_clipboard_propose_write: {
    title: 'Prepare text to copy',
    state:
      'Creates a pending clipboard proposal; the clipboard changes only after the visible Copy approved text button.',
    recovery:
      'Review or dismiss the existing proposal first. If writing is unavailable, select and copy the text manually.',
    result: { proposalId: 'example-proposal', status: 'awaiting_user' },
  },
  capability_export: {
    title: 'Get workflow JSON',
    state: 'Reads a saved cartridge. The visible Export button owns the file download.',
    recovery:
      'Use the saved cartridge ID returned by workflow_stop_recording or shown in Workspace. An unknown ID fails.',
    result: starterCartridge,
  },
}

export function documentationModel(registry: ToolRegistry) {
  return registry.definitions.map((tool) => {
    const note = notes[tool.name]
    const schema = registry.schema(tool.name) as {
      properties?: Record<string, unknown>
      required?: string[]
      oneOf?: unknown
    }
    const exampleValid = tool.schema.safeParse(tool.example).success
    const data = note?.result ?? accepted
    return {
      name: tool.name,
      title: note?.title ?? tool.name.replaceAll('_', ' '),
      description: tool.description,
      classification: tool.readOnly
        ? 'Read-only'
        : tool.name.startsWith('desktop_') ||
            ['goal_start', 'goal_rerun', 'browser_clipboard_propose_write'].includes(tool.name)
          ? 'Approval required'
          : 'Mutating',
      readOnly: !!tool.readOnly,
      schema,
      properties: Object.keys(schema.properties ?? {}).map((name) => ({
        name,
        required: schema.required?.includes(name) ?? false,
      })),
      arguments: tool.example,
      exampleValid,
      result: { ok: true, data },
      resultValid: tool.output.safeParse(data).success,
      state:
        note?.state ?? 'Uses the shared Lens service. Review its current handler before running.',
      recovery:
        note?.recovery ??
        'Read the structured error, correct the arguments and inspect the current state before retrying.',
      prompt:
        note?.prompt ??
        `In Lens, use ${tool.name} with ${JSON.stringify(tool.example)}. ${tool.readOnly ? 'Explain the structured result.' : 'Ask me to review this operation before running it, then check the visible result.'}`,
      source: 'apps/web/src/webmcp/tools.ts',
      registration: 'apps/web/src/webmcp/nativeAdapter.ts',
      annotations: { readOnlyHint: !!tool.readOnly, untrustedContentHint: true },
    }
  })
}

// Documentation runs only read operations. Changes are previews, never executions.
export async function runDocumentationTool(
  registry: ToolRegistry,
  name: string,
  input: unknown,
  signal?: AbortSignal,
) {
  const tool = registry.definitions.find((t) => t.name === name)
  if (!tool?.readOnly)
    throw new Error('Review this operation in Workspace. Documentation does not execute changes.')
  return registry.invoke(name, input, signal)
}
