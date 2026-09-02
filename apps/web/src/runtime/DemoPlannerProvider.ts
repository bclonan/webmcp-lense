import type {
  ActionRequest,
  Goal,
  GoalPlan,
  NormalizedPoint,
  PlannerProvider,
  PlanStep,
  ScreenObservation,
} from '@lens/protocol'
export class DemoPlannerProvider implements PlannerProvider {
  async plan(goal: Goal, observation: ScreenObservation): Promise<GoalPlan> {
    if (observation.source !== 'fixture')
      throw new Error(
        'Demo planning uses fixtures. For live capture, use reviewed manual actions or connect a real vision/planner adapter.',
      )
    const text = goal.text.toLowerCase()
    const app = text.includes('paint')
      ? 'Paint'
      : text.includes('notepad')
        ? 'Notepad'
        : text.includes('claim')
          ? 'Legacy Claims Manager'
          : undefined
    if (!app) throw new Error('Try one of the Paint, Notepad or Legacy Claims Manager goals.')
    const supported =
      app === 'Paint'
        ? /^(?:open\s+)?paint(?:\s+and\s+draw(?:\s+a)?(?:\s+small)?\s+house(?:\s+with(?:\s+a)?\s+sun)?)?\.?$/i.test(
            goal.text.trim(),
          )
        : app === 'Notepad'
          ? /^(?:open\s+)?notepad(?:\s+and\s+write:\s*[\s\S]+)?\.?$/i.test(goal.text.trim())
          : /^(?:open\s+legacy claims manager\s+and\s+)?submit\s+claim\s+CLM-[a-zA-Z0-9]+\.?$/i.test(
              goal.text.trim(),
            )
    if (!supported)
      throw new Error(
        'This goal is outside the deterministic scenarios. Choose a demo or use individual reviewed actions.',
      )
    const steps: PlanStep[] = []
    const add = (action: ActionRequest, expected?: string) =>
      steps.push({ kind: 'action', action, expected })
    add({ type: 'keyboard.key', key: 'WIN', description: 'Open Start search' }, 'Start search:')
    add({ type: 'keyboard.text', text: app, description: `Search for ${app}` }, app)
    add(
      { type: 'keyboard.key', key: 'ENTER', description: `Open ${app}` },
      `${app}${app === 'Legacy Claims Manager' ? '.' : ' open'}`,
    )
    if (app === 'Paint') {
      const paths: NormalizedPoint[][] = [
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
      steps.push({ kind: 'locate', text: 'Drawing canvas' })
      paths.forEach((points, index) =>
        add(
          {
            type: 'pointer.drag',
            targetId: 'visual:canvas',
            points,
            durationMs: 600,
            description: ['Draw the walls', 'Draw the roof', 'Draw the door', 'Draw the sun'][
              index
            ],
          },
          `${index + 1} strokes drawn`,
        ),
      )
      steps.push({ kind: 'assert', text: 'House and sun complete' })
    } else if (app === 'Notepad') {
      const content = goal.text.match(/write\s*:\s*([\s\S]+)/i)?.[1] ?? 'The house is finished.'
      add({ type: 'pointer.click', targetId: 'visual:editor', description: 'Focus the document' })
      add({ type: 'keyboard.text', text: content, description: 'Write the document text' }, content)
      steps.push({ kind: 'assert', text: content })
    } else {
      const claim = goal.text.match(/CLM-[a-zA-Z0-9]+/i)?.[0] ?? 'CLM-2048'
      add({
        type: 'pointer.click',
        targetId: 'visual:claim-number',
        description: 'Focus the claim number',
      })
      add(
        { type: 'keyboard.text', text: claim, description: 'Enter the fictional claim number' },
        claim,
      )
      add(
        {
          type: 'pointer.click',
          targetId: 'visual:submit-claim',
          description: 'Submit the fictional claim',
          consequential: true,
        },
        'Claim submitted',
      )
      steps.push({ kind: 'assert', text: 'Claim submitted' })
    }
    return { goal, steps, provider: 'Deterministic demo planner' }
  }
}
