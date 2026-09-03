import { ulid } from 'ulid'
import type {
  ActionRequest,
  CaptureGeometry,
  DesktopBridge,
  DesktopCommand,
  EventType,
  Goal,
  GoalPlan,
  PendingApproval,
  PlannerProvider,
  RuntimeState,
  ScreenObservation,
} from '@lens/protocol'
import { commandSchema } from '@lens/schemas'
import { normalizedToDesktop, resolveTarget } from '../screen/coordinates'
import { PolicyEngine } from '../policy/PolicyEngine'
import { pause } from './async'
export interface RuntimeHooks {
  observe(): Promise<ScreenObservation>
  changed(previous: ScreenObservation, signal: AbortSignal): Promise<ScreenObservation>
  geometry(): CaptureGeometry
  state(value: RuntimeState): void
  event(type: EventType, message: string, data?: Record<string, unknown>): void
  proposed(action: ActionRequest | null): void
  approval(value: PendingApproval | null): void
  policy(value: string): void
  native(): boolean
  pace(): number
  progress?(step: number, total: number): void
}
class BridgeExecutionError extends Error {}
const transitions: Record<RuntimeState, RuntimeState[]> = {
  idle: ['observing'],
  observing: ['planning', 'action_proposed', 'verifying'],
  planning: ['observing'],
  action_proposed: ['policy_check'],
  policy_check: ['waiting_for_approval', 'executing'],
  waiting_for_approval: ['executing'],
  executing: ['waiting_for_change'],
  waiting_for_change: ['verifying'],
  verifying: ['observing', 'completed'],
  completed: ['observing'],
  failed: ['observing'],
  cancelled: ['observing'],
}
export class ComputerRuntime {
  state: RuntimeState = 'idle'
  busy = false
  private controller?: AbortController
  private resolveApproval?: (approved: boolean) => void
  private pendingId?: string
  constructor(
    private bridge: DesktopBridge,
    private planner: PlannerProvider,
    private hooks: RuntimeHooks,
    private policy = new PolicyEngine(),
  ) {}
  private transition(next: RuntimeState) {
    if (!['cancelled', 'failed'].includes(next) && !transitions[this.state].includes(next))
      throw new Error(`Invalid runtime transition ${this.state} → ${next}`)
    this.hooks.event('runtime.transition', `${this.state} → ${next}`, {
      from: this.state,
      to: next,
    })
    this.state = next
    this.hooks.state(next)
  }
  cancel() {
    if (!this.busy || this.controller?.signal.aborted) return
    const duringExecution = this.state === 'executing'
    this.controller?.abort()
    this.resolveApproval?.(false)
    this.resolveApproval = undefined
    this.pendingId = undefined
    this.hooks.approval(null)
    this.hooks.proposed(null)
    this.transition('cancelled')
    this.hooks.event('goal.cancelled', 'Control cancelled. No further actions will execute.', {
      duringExecution,
    })
  }
  approve(id: string, accepted: boolean) {
    if (id !== this.pendingId || !this.resolveApproval)
      throw new Error('This approval is no longer pending.')
    this.hooks.event(
      accepted ? 'approval.granted' : 'approval.denied',
      accepted ? 'Human approved the proposed action.' : 'Human denied the proposed action.',
      { approvalId: id },
    )
    this.resolveApproval(accepted)
    this.resolveApproval = undefined
    this.pendingId = undefined
    this.hooks.approval(null)
  }
  async run(goal: Goal, providedPlan?: GoalPlan, externalSignal?: AbortSignal): Promise<void> {
    if (this.busy) throw new Error('A goal is already active. Cancel it before starting another.')
    if (externalSignal?.aborted) throw new Error('Request cancelled.')
    this.busy = true
    this.controller = new AbortController()
    const signal = this.controller.signal
    const abort = () => this.cancel()
    externalSignal?.addEventListener('abort', abort, { once: true })
    this.hooks.event('goal.started', goal.text, { goalId: goal.id })
    try {
      this.transition('observing')
      const initial = await this.hooks.observe()
      signal.throwIfAborted()
      this.transition('planning')
      const plan = providedPlan ?? (await this.planner.plan(goal, initial))
      signal.throwIfAborted()
      if (!plan.steps.length || plan.steps.length > 100)
        throw new Error('A plan must have between 1 and 100 bounded steps.')
      for (const [index, step] of plan.steps.entries()) {
        this.hooks.progress?.(index + 1, plan.steps.length)
        signal.throwIfAborted()
        this.transition('observing')
        const before = await this.hooks.observe()
        signal.throwIfAborted()
        if (step.kind === 'action') await this.action(step.action, before, step.expected, signal)
        else {
          this.transition('verifying')
          let observation = before
          if (step.kind === 'waitFor' && !this.matches(before, step.text))
            observation = await this.hooks.changed(before, signal)
          signal.throwIfAborted()
          if (!this.matches(observation, step.text))
            throw new Error(`${step.kind} failed: ${step.text}`)
          this.hooks.event('action.verified', `${step.kind}: ${step.text}`)
        }
        await pause(this.hooks.pace(), signal)
      }
      signal.throwIfAborted()
      this.hooks.proposed(null)
      this.transition('completed')
      this.hooks.event('goal.completed', 'Goal complete. All planned assertions passed.')
    } catch (error) {
      if (!signal.aborted) {
        this.transition('failed')
        this.hooks.event('goal.failed', error instanceof Error ? error.message : String(error), {
          bridgeFailure: error instanceof BridgeExecutionError,
        })
      }
    } finally {
      this.busy = false
      this.resolveApproval = undefined
      this.pendingId = undefined
      this.hooks.approval(null)
      externalSignal?.removeEventListener('abort', abort)
    }
  }
  private matches(o: ScreenObservation, text: string) {
    return `${o.summary} ${o.regions.map((r) => `${r.label} ${r.text}`).join(' ')}`
      .toLowerCase()
      .includes(text.toLowerCase())
  }
  private async action(
    action: ActionRequest,
    before: ScreenObservation,
    expected: string | undefined,
    signal: AbortSignal,
  ) {
    this.transition('action_proposed')
    this.hooks.proposed(action)
    this.hooks.event('action.proposed', action.description, { action })
    const command = this.command(action, before)
    this.transition('policy_check')
    const policy = this.policy.evaluate(action, before, this.hooks.native())
    this.hooks.policy(`${policy.decision}: ${policy.reason}`)
    if (policy.decision === 'BLOCK') throw new Error(`Policy blocked: ${policy.reason}`)
    if (policy.decision === 'ASK') {
      this.transition('waiting_for_approval')
      const id = ulid()
      this.pendingId = id
      const decision = new Promise<boolean>((resolve) => {
        this.resolveApproval = resolve
      })
      this.hooks.approval({ id, action, reason: policy.reason })
      this.hooks.event('approval.requested', policy.reason, { approvalId: id })
      const approved = await decision
      signal.throwIfAborted()
      if (!approved) throw new Error('Action denied. Nothing was sent to the bridge.')
      const fresh = await this.hooks.observe()
      signal.throwIfAborted()
      if (fresh.revision !== before.revision)
        throw new Error('Screen changed during approval. Re-observe and propose again.')
    }
    if (this.hooks.native() && action.type.startsWith('keyboard.')) {
      this.hooks.policy(
        'APPROVED: Focus the intended desktop window now. Keyboard input starts in 3 seconds.',
      )
      await pause(3000, signal)
    } else await pause(this.hooks.pace(), signal)
    this.transition('executing')
    let result
    try {
      result = await this.bridge.execute(command)
    } catch (error) {
      throw new BridgeExecutionError(error instanceof Error ? error.message : String(error))
    }
    this.hooks.event(
      'action.executed',
      result.ok ? action.description : (result.error ?? 'Bridge failed'),
      { command, result, action, approvalRequired: policy.decision === 'ASK' },
    )
    signal.throwIfAborted()
    if (!result.ok) throw new BridgeExecutionError(result.error ?? 'Bridge execution failed.')
    this.transition('waiting_for_change')
    if (
      action.type === 'pointer.move' ||
      (action.type === 'keyboard.key' && ['CTRL+C', 'CMD+C'].includes(action.key ?? ''))
    ) {
      const after = await this.hooks.observe()
      signal.throwIfAborted()
      this.transition('verifying')
      if (expected && !this.matches(after, expected))
        throw new Error(`Verification failed: expected ${expected}`)
      this.hooks.event(
        'action.verified',
        'Bridge acknowledged input. This action has no required visual change; clipboard contents are not asserted.',
        { observationId: after.id },
      )
      return
    }
    const after = await this.hooks.changed(before, signal)
    signal.throwIfAborted()
    this.hooks.event('screen.changed', after.summary, {
      beforeRevision: before.revision,
      afterRevision: after.revision,
    })
    this.transition('verifying')
    if (expected && !this.matches(after, expected))
      throw new Error(`Verification failed: expected ${expected}`)
    this.hooks.event(
      'action.verified',
      expected
        ? `Confirmed: ${expected}`
        : 'Observed a screen change after execution. Semantic outcome is not asserted.',
      { observationId: after.id },
    )
  }
  private command(a: ActionRequest, o: ScreenObservation): DesktopCommand {
    const id = ulid(),
      geometry = this.hooks.geometry()
    const point = () =>
      normalizedToDesktop(
        a.targetId
          ? resolveTarget(a.targetId, o)
          : (a.point ??
              (() => {
                throw new Error('Provide a current targetId or normalized point.')
              })()),
        geometry,
      )
    switch (a.type) {
      case 'pointer.move':
        return commandSchema.parse({ id, type: a.type, point: point() })
      case 'pointer.click':
        return commandSchema.parse({ id, type: a.type, point: point(), button: a.button ?? 'left' })
      case 'pointer.drag':
        return commandSchema.parse({
          id,
          type: a.type,
          points: a.points?.map((p) => normalizedToDesktop(p, geometry)),
          durationMs: a.durationMs ?? 600,
        })
      case 'keyboard.text':
        return commandSchema.parse({ id, type: a.type, text: a.text })
      case 'keyboard.key':
        return commandSchema.parse({ id, type: a.type, key: a.key })
      case 'scroll':
        return commandSchema.parse({ id, type: a.type, delta: a.delta })
    }
  }
}
