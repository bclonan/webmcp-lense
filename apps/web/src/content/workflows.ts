export const workflows = [
  {
    id: 'paint',
    name: 'Observe, draw and verify',
    goal: 'Draw a house and sun in the demo Paint canvas.',
    steps: [
      {
        tool: 'screen_get_context',
        uses: [],
        detail: 'Check data.source is fixture and read the current desktop.',
      },
      {
        tool: 'goal_start',
        uses: ['steps.0.data.source'],
        detail:
          'After the person enables demo control, submit the Paint goal and retain data.goalId.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.1.data.goalId'],
        detail:
          'Check the current goal matches the accepted ID. Wait until busy is false; stop for approvalPending.',
      },
      {
        tool: 'screen_get_context',
        uses: ['steps.2.data.state'],
        detail: 'Only after completed, read the visible fixture result and four pointer paths.',
      },
      {
        tool: 'session_get_events',
        uses: ['steps.1.data.goalId'],
        detail:
          'Read the timeline and correlate the current goal with its action and verification events.',
      },
    ],
    boundary:
      'The person enables demo control. Any ASK decision pauses in Workspace. Native input requires a separate pairing and approval flow.',
    failure:
      'An accepted goal is still running. On failed or cancelled, stop the chain and inspect events. Never call a second goal while busy.',
    prompt:
      'In Lens, inspect screen_get_context. If this is the fixture desktop, wait for me to enable demo control, then call goal_start to open Paint and draw a small house with a sun. Track its goalId using goal_status. Pause for any approval. After completion, inspect screen_get_context and session_get_events, and explain what was verified.',
  },
  {
    id: 'record',
    name: 'Turn a successful run into a workflow',
    goal: 'Record a Notepad sequence and inspect its portable JSON.',
    steps: [
      {
        tool: 'workflow_start_recording',
        uses: [],
        detail: 'After the person requests recording, start recording only Lens actions.',
      },
      {
        tool: 'desktop_run_sequence',
        uses: ['steps.0.data.recording'],
        detail:
          'Use the catalog Notepad example after demo control is enabled. Retain data.goalId.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.1.data.goalId'],
        detail: 'Wait for completion or stop on failure. Do not save while busy.',
      },
      {
        tool: 'workflow_stop_recording',
        uses: ['steps.2.data.state'],
        detail:
          'Pass name: My Notepad workflow. The returned data.id identifies the saved cartridge.',
      },
      {
        tool: 'capability_export',
        uses: ['steps.3.data.id'],
        detail:
          'Pass the returned cartridge ID as id. Receive JSON; the person clicks Export to download a file.',
      },
    ],
    boundary:
      'Recording and saving require a deliberate user request. Desktop actions follow the same runtime approval policy. File export stays a visible button.',
    failure:
      'Save only when settled. An empty recording cannot be saved. Preserve a successful partial recording for review if a later action failed.',
    prompt:
      'After I enable the Lens demo and request recording, start workflow_start_recording. Use desktop_run_sequence to open Notepad and enter Hello from Lens. Poll goal_status until settled. If completed, save it with workflow_stop_recording named My Notepad workflow. Pass its returned id to capability_export. Show me the JSON and let me choose Export in Workspace.',
  },
  {
    id: 'review',
    name: 'Review a fictional claim',
    goal: 'Fill the demo claim and leave its final submission to the person.',
    steps: [
      {
        tool: 'goal_start',
        uses: [],
        detail: 'With demo control enabled, request the fictional claims scenario for CLM-2048.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.0.data.goalId'],
        detail: 'When approvalPending is true, bring the person to the visible approval card.',
      },
      {
        tool: 'screen_get_context',
        uses: ['steps.1.data.approvalPending'],
        detail: 'Explain the draft fixture state while no final submission has happened.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.0.data.goalId'],
        detail:
          'After the person approves or denies, report completed or failed without supplying approval yourself.',
      },
      {
        tool: 'session_get_events',
        uses: ['steps.3.data.state'],
        detail: 'Read the approval decision and result from the timeline.',
      },
    ],
    boundary:
      'The final fictional submission requires the person to click Approve action. There is no WebMCP tool that grants approval.',
    failure:
      'A denial stops the goal. Do not rerun or submit by another path. This uses fictional data and is not a medical or financial integration.',
    prompt:
      'In the enabled Lens fixture, prepare and submit fictional claim CLM-2048 using goal_start. Check goal_status and pause when approvalPending is true. Explain the draft using screen_get_context and let me approve or deny in Workspace. Then read goal_status and session_get_events. Do not grant approval for me.',
  },
  {
    id: 'clipboard',
    name: 'Prepare a reviewed clipboard handoff',
    goal: 'Prepare a short result summary without silently changing the clipboard.',
    steps: [
      {
        tool: 'browser_get_capabilities',
        uses: [],
        detail:
          'Check data.clipboardWrite. This call does not read clipboard text or request access.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.0.data.clipboardWrite'],
        detail: 'Read the actual runtime state. Avoid claiming completion when busy or failed.',
      },
      {
        tool: 'session_get_events',
        uses: ['steps.1.data.state'],
        detail: 'Read bounded events to support the proposed summary.',
      },
      {
        tool: 'browser_clipboard_propose_write',
        uses: ['steps.2.data.events'],
        detail:
          'After the person requests it, pass a short summary as text. Result is awaiting_user, not copied.',
      },
    ],
    boundary:
      'The person reviews the text and clicks Copy approved text. The browser owns clipboard permissions and user activation.',
    failure:
      'If clipboardWrite is false, display selectable text. A denied proposal does not write anything. Do not silently read the clipboard.',
    prompt:
      'Inspect browser_get_capabilities, goal_status and the latest session_get_events in Lens. Draft a short summary grounded in the events. If I request a copy and clipboard writing is available, call browser_clipboard_propose_write. Wait for me to click Copy approved text; do not say it was copied based only on awaiting_user.',
  },
  {
    id: 'recover',
    name: 'Recover without duplicating input',
    goal: 'Inspect a failed or stuck sequence and decide whether a fresh run is appropriate.',
    steps: [
      {
        tool: 'goal_status',
        uses: [],
        detail: 'Read busy, failure and the current step before choosing a recovery action.',
      },
      {
        tool: 'goal_cancel',
        uses: ['steps.0.data.busy'],
        detail: 'Only if still busy and the person asks to cancel, cancel the remaining work.',
      },
      {
        tool: 'session_get_events',
        uses: ['steps.0.data.failure'],
        detail: 'Read the first page; use data.nextCursor as after on subsequent pages.',
      },
      {
        tool: 'screen_get_context',
        uses: ['steps.2.data.events'],
        detail: 'Inspect what actually changed. Earlier actions may already have happened.',
      },
      {
        tool: 'goal_rerun',
        uses: ['steps.3.data.revision'],
        detail:
          'Only after explicit user approval and a suitable desktop state, start again from step 1 with new IDs.',
      },
      {
        tool: 'goal_status',
        uses: ['steps.4.data.goalId'],
        detail: 'Follow the fresh goal rather than assuming the earlier run resumed.',
      },
    ],
    boundary:
      'Cancellation and especially rerun require the person’s request. Rerun may duplicate text or other effects. Bridge failure requires manual reconnect.',
    failure:
      'If the outcome is uncertain, stop at inspection. No automatic retry, no skipped failed step, and no replay of old approval.',
    prompt:
      'Read goal_status and session_get_events in Lens. If work is still active, ask before goal_cancel. Inspect screen_get_context to see which effects happened. Explain the failure and whether reconnecting is needed. Do not call goal_rerun unless I explicitly request a new run from step 1 after reviewing duplicate effects.',
  },
]

export const promptLibrary = [
  {
    group: 'Discover or search',
    level: 'Beginner',
    prompt:
      'Use browser_get_capabilities, then screen_locate with query Paint. Tell me what is supported and which visible fixture regions match.',
    tools: ['browser_get_capabilities', 'screen_locate'],
  },
  {
    group: 'Create',
    level: 'Beginner',
    prompt: workflows[0].prompt,
    tools: ['goal_start', 'goal_status'],
  },
  {
    group: 'Inspect',
    level: 'Beginner',
    prompt:
      'Read goal_status and the latest 20 session_get_events in Lens. Explain the current step and any approval needed. Do not run an action.',
    tools: ['goal_status', 'session_get_events'],
  },
  {
    group: 'Update',
    level: 'Intermediate',
    prompt:
      'After I focus the demo Notepad editor and enable demo control, propose desktop_type with text The house is finished. Then check goal_status and the visible result. Do not repeat text if the outcome is uncertain.',
    tools: ['desktop_type', 'goal_status'],
  },
  {
    group: 'Transform',
    level: 'Showcase',
    prompt: workflows[1].prompt,
    tools: [
      'workflow_start_recording',
      'desktop_run_sequence',
      'workflow_stop_recording',
      'capability_export',
    ],
  },
  {
    group: 'Compare',
    level: 'Intermediate',
    prompt:
      'Take a screen_get_context observation in Lens before and after the next action I approve. Compare the returned revision and summary. Do not claim semantic success from a live pixel change.',
    tools: ['screen_get_context', 'goal_status'],
  },
  {
    group: 'Refresh',
    level: 'Beginner',
    prompt:
      'Refresh screen_get_context and run screen_locate with query canvas. Use fresh regions and report an empty list honestly.',
    tools: ['screen_get_context', 'screen_locate'],
  },
  {
    group: 'Export or share',
    level: 'Intermediate',
    prompt:
      'Use capability_export with id lens-claims-v1 to inspect the starter workflow. Return its JSON locally. I will use the visible Export button if I want a file.',
    tools: ['capability_export'],
  },
  {
    group: 'Approve or confirm',
    level: 'Showcase',
    prompt: workflows[2].prompt,
    tools: ['goal_start', 'goal_status', 'screen_get_context', 'session_get_events'],
  },
  {
    group: 'Recover from failure',
    level: 'Intermediate',
    prompt: workflows[4].prompt,
    tools: ['goal_status', 'goal_cancel', 'session_get_events', 'screen_get_context', 'goal_rerun'],
  },
]
