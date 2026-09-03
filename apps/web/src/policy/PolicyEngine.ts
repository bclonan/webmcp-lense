import type { ActionRequest, PolicyDecision, ScreenObservation } from '@lens/protocol'
export type PolicyRule = (
  action: ActionRequest,
  observation: ScreenObservation,
) => PolicyDecision | undefined
export class PolicyEngine {
  constructor(private extraRules: PolicyRule[] = []) {}
  evaluate(action: ActionRequest, observation: ScreenObservation, native = false): PolicyDecision {
    const target = observation.regions.find((r) => r.id === action.targetId)
    const content = `${action.description} ${action.text ?? ''} ${target?.label ?? ''}`
    if (
      /password\s*(extract|dump)|extract\s*password|bypass|security settings|powershell|cmd\.exe|bash\b|shell command|system command|curl\b|regedit|sudo\b/i.test(
        content,
      )
    )
      return {
        decision: 'BLOCK',
        reason:
          'System commands, credential extraction and permission bypass are outside Lens control.',
      }
    for (const rule of this.extraRules) {
      const decision = rule(action, observation)
      if (decision && decision.decision !== 'ALLOW') return decision
    }
    if (
      action.consequential ||
      target?.consequential ||
      /\b(submit|delete|send|purchase|pay|save|close)\b/i.test(content) ||
      ['DELETE', 'ALT+F4', 'CTRL+S', 'CTRL+V', 'CMD+S', 'CMD+V', 'CMD+W'].includes(action.key ?? '')
    )
      return {
        decision: 'ASK',
        reason: 'This action changes or commits work. Review it before execution.',
      }
    if (native && action.type !== 'pointer.move' && action.type !== 'scroll')
      return {
        decision: 'ASK',
        reason: 'Live vision is not configured. Confirm the intended desktop target and action.',
      }
    return { decision: 'ALLOW', reason: 'Bounded navigation, drawing or ordinary text entry.' }
  }
}
