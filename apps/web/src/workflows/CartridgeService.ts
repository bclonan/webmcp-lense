import { ulid } from 'ulid'
import type {
  ActionRequest,
  CapabilityCartridge,
  CartridgeStep,
  GoalPlan,
  RuntimeEvent,
} from '@lens/protocol'
import { cartridgeSchema } from '@lens/schemas'
export class CartridgeService {
  private events: RuntimeEvent[] | null = null
  start() {
    if (this.events) throw new Error('A recording is already active.')
    this.events = []
  }
  append(event: RuntimeEvent) {
    if (
      this.events &&
      (event.type === 'workflow.annotated' ||
        (event.type === 'action.executed' &&
          (event.data?.result as { ok?: boolean })?.ok &&
          (event.data?.action as ActionRequest)?.type !== 'pointer.move'))
    )
      this.events.push(event)
  }
  stop(
    name: string,
    application: string,
    assertion: string,
    source = 'fixture',
  ): CapabilityCartridge {
    if (!this.events) throw new Error('Start a workflow recording first.')
    const events = this.events
    this.events = null
    const steps = events
      .filter((e) => e.type === 'action.executed')
      .map((event) =>
        this.toStep({
          ...(event.data!.action as ActionRequest),
          consequential: !!event.data?.approvalRequired,
        }),
      )
    if (!steps.length)
      throw new Error('No successful Lens actions were recorded. Run a goal while recording.')
    return cartridgeSchema.parse({
      version: 1,
      id: ulid(),
      name,
      description: 'Recorded Lens actions. Review each step before replay.',
      application,
      inputs: {},
      steps,
      assertions: assertion ? [assertion] : [],
      approvalRequirements: steps.filter((s) => s.approval).map((s) => s.targetId ?? s.type),
      metadata: {
        createdAt: Date.now(),
        observationSource: source,
        author: 'Local user',
        notes: events.filter((e) => e.type === 'workflow.annotated').map((e) => e.message),
      },
    })
  }
  private toStep(a: ActionRequest): CartridgeStep {
    const approval = a.consequential || undefined
    switch (a.type) {
      case 'pointer.click':
        return { type: 'click', targetId: a.targetId, point: a.point, button: a.button, approval }
      case 'pointer.drag':
        return { type: 'drag', points: a.points, durationMs: a.durationMs, approval }
      case 'keyboard.text':
        return { type: 'type', text: a.text, approval }
      case 'keyboard.key':
        return { type: 'press', key: a.key, approval }
      case 'scroll':
        return { type: 'scroll', delta: a.delta, approval }
      case 'pointer.move':
        throw new Error('Pointer-only movements do not form reusable workflow steps.')
    }
  }
}
export function compileCartridge(value: unknown, variables: Record<string, string>): GoalPlan {
  const cartridge = cartridgeSchema.parse(value)
  const input = { ...cartridge.inputs, ...variables }
  const substitute = (text: string) =>
    text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_, key: string) => {
      if (!Object.hasOwn(input, key) || typeof input[key] !== 'string' || input[key].length > 500)
        throw new Error(`Missing or invalid input: ${key}`)
      return input[key]
    })
  const steps: GoalPlan['steps'] = cartridge.steps.map((s: CartridgeStep) => {
    const text = s.text === undefined ? undefined : substitute(s.text)
    if (s.type === 'locate' || s.type === 'waitFor' || s.type === 'assert')
      return { kind: s.type, text: text! }
    const type = {
      click: 'pointer.click',
      type: 'keyboard.text',
      press: 'keyboard.key',
      scroll: 'scroll',
      drag: 'pointer.drag',
    }[s.type] as ActionRequest['type']
    return {
      kind: 'action',
      action: {
        ...s,
        text,
        type,
        description: `Workflow ${s.type}: ${s.targetId ?? text ?? s.key ?? ''}`,
        consequential:
          s.approval ||
          cartridge.approvalRequirements.some((r) => r === '*' || r === s.targetId || r === s.type),
      },
    }
  })
  steps.push(
    ...cartridge.assertions.map((text) => ({ kind: 'assert' as const, text: substitute(text) })),
  )
  return {
    goal: { id: ulid(), text: `Run workflow: ${cartridge.name}` },
    provider: 'Capability cartridge',
    steps,
  }
}
export const starterCartridge: CapabilityCartridge = {
  version: 1,
  id: 'lens-claims-v1',
  name: 'Submit a reviewed claim',
  description: 'Open the fictional claims app, enter a claim number and pause for approval.',
  application: 'Legacy Claims Manager',
  inputs: { claimNumber: 'CLM-2048' },
  steps: [
    { type: 'press', key: 'WIN' },
    { type: 'type', text: 'Legacy Claims Manager' },
    { type: 'press', key: 'ENTER' },
    { type: 'click', targetId: 'visual:claim-number' },
    { type: 'type', text: '{{claimNumber}}' },
    { type: 'click', targetId: 'visual:submit-claim', approval: true },
  ],
  assertions: ['Claim submitted'],
  approvalRequirements: [],
  metadata: { createdAt: 1788307200000, observationSource: 'fixture', author: 'Lens demo' },
}
