import { ulid, monotonicFactory } from 'ulid'
import type { ActionRequest, DesktopBridge, EventType, GoalPlan } from '@lens/protocol'
import { freshDesktop } from '@lens/fixtures'
import { useSessionStore } from '../stores/session'
import { useScreenStore } from '../stores/screen'
import { useBridgeStore } from '../stores/bridge'
import { useRuntimeStore } from '../stores/runtime'
import { useApprovalsStore } from '../stores/approvals'
import { useSettingsStore } from '../stores/settings'
import { Repository } from '../persistence/Repository'
import { MockDesktopBridge } from '../bridge/MockDesktopBridge'
import { MockVisionProvider } from '../vision/MockVisionProvider'
import { DemoPlannerProvider } from '../runtime/DemoPlannerProvider'
import { ComputerRuntime } from '../runtime/ComputerRuntime'
import { pause } from '../runtime/async'
import { ScreenCaptureService } from '../screen/ScreenCaptureService'
import { LocalDesktopBridge } from '../bridge/LocalDesktopBridge'
import { CartridgeService, compileCartridge, starterCartridge } from '../workflows/CartridgeService'
import { cartridgeSchema } from '@lens/schemas'
import { createTools } from '../webmcp/tools'
const eventId = monotonicFactory()
export class LensService {
  readonly session = useSessionStore()
  readonly screen = useScreenStore()
  readonly bridgeState = useBridgeStore()
  readonly runtimeState = useRuntimeStore()
  readonly approvals = useApprovalsStore()
  readonly settings = useSettingsStore()
  readonly repository = new Repository()
  readonly recorder = new CartridgeService()
  bridge: DesktopBridge = new MockDesktopBridge(this.screen.desktop)
  runtime: ComputerRuntime
  readonly tools = createTools(this)
  readonly capture = new ScreenCaptureService(
    () => {
      this.screen.changeRevision++
    },
    () => {
      this.screen.sharing = false
      this.screen.geometry.calibrated = false
      this.event('capture.stopped', 'Screen sharing ended. All media tracks stopped.')
      void this.stop()
    },
    () => this.settings.sampleInterval,
  )
  constructor() {
    this.runtime = this.makeRuntime()
  }
  private makeRuntime() {
    return new ComputerRuntime(this.bridge, new DemoPlannerProvider(), {
      observe: () => this.observe(),
      changed: (before, signal) => this.waitForChange(before.revision, signal),
      geometry: () => this.screen.geometry,
      state: (value) => {
        this.runtimeState.state = value
      },
      event: (type, message, data) => this.event(type, message, data),
      proposed: (value) => {
        this.runtimeState.proposed = value
      },
      approval: (value) => {
        this.approvals.pending = value
      },
      policy: (value) => {
        this.runtimeState.policy = value
      },
      native: () => this.session.mode === 'live',
      pace: () => this.settings.stepDelay,
    })
  }
  async init() {
    try {
      const [settings, cartridges, history] = await Promise.all([
        this.repository.settings(),
        this.repository.cartridges(),
        this.repository.sessions(),
      ])
      if (settings) {
        this.settings.changeThreshold = Math.min(
          0.5,
          Math.max(0.005, settings.changeThreshold ?? 0.025),
        )
        this.settings.stepDelay = Math.min(1500, Math.max(0, settings.stepDelay ?? 450))
      }
      this.session.cartridges = cartridges.length ? cartridges : [starterCartridge]
      this.session.history = history.reverse()
      this.capture.detector.threshold = this.settings.changeThreshold
    } catch {
      this.session.persistenceError =
        'Local storage is unavailable. This session will remain in memory.'
    }
    await this.observe()
  }
  event(type: EventType, message: string, data?: Record<string, unknown>) {
    const event = {
      id: eventId(),
      sessionId: this.session.id,
      timestamp: Date.now(),
      type,
      message,
      data,
    }
    this.session.events.push(event)
    this.recorder.append(event)
    void this.repository.append(event).catch(() => {
      this.session.persistenceError = 'Could not save the event log. Keep this tab open.'
    })
    if (type === 'goal.failed' && this.session.mode === 'live') {
      this.session.authorized = false
      this.bridgeState.status = 'disconnected'
      void this.bridge.emergencyStop().catch(() => {
        this.bridgeState.error = 'Bridge connection lost. Use Ctrl+Alt+F10 to stop native input.'
      })
    }
  }
  async observe() {
    const observation =
      this.session.mode === 'demo'
        ? await new MockVisionProvider(this.screen.desktop).observe()
        : {
            id: ulid(),
            timestamp: Date.now(),
            frameSize: {
              width: this.screen.geometry.captureWidth,
              height: this.screen.geometry.captureHeight,
            },
            summary: this.screen.sharing
              ? 'Live capture. No real vision provider configured. Use reviewed coordinate actions.'
              : 'No screen is being shared.',
            regions: [],
            source: 'unavailable' as const,
            revision: this.screen.changeRevision,
          }
    this.screen.observation = observation
    this.event('screen.observed', observation.summary, { observation })
    return observation
  }
  async waitForChange(revision: number, signal: AbortSignal) {
    for (let i = 0; i < 40; i++) {
      signal.throwIfAborted()
      if (
        (this.session.mode === 'demo'
          ? this.screen.desktop.revision
          : this.screen.changeRevision) !== revision
      )
        return this.observe()
      await pause(100, signal)
    }
    throw new Error('No screen change detected within 4 seconds. Control paused.')
  }
  async enableDemo(reset = false) {
    if (this.runtime.busy) throw new Error('Stop the current goal before changing the desktop.')
    this.capture.stop()
    await this.bridge.disconnect().catch(() => {})
    this.session.mode = 'demo'
    if (reset) Object.assign(this.screen.desktop, freshDesktop())
    this.bridge = new MockDesktopBridge(this.screen.desktop)
    this.runtime = this.makeRuntime()
    this.runtimeState.$patch({ state: 'idle', goal: null, proposed: null, policy: '' })
    await this.bridge.connect()
    this.bridgeState.capabilities = await this.bridge.capabilities()
    this.screen.geometry = {
      captureWidth: 1001,
      captureHeight: 701,
      desktopBounds: this.bridgeState.capabilities.desktopBounds,
      displayScale: 1,
      calibrated: true,
    }
    this.session.authorized = true
    this.bridgeState.status = 'connected'
    this.session.error = ''
    this.event(
      'bridge.connected',
      'Demo control explicitly enabled. Commands stay inside this browser.',
    )
    await this.repository
      .saveSession({ id: this.session.id, createdAt: Date.now(), mode: this.session.mode })
      .catch(() => {})
    await this.observe()
  }
  startGoal(text: string, plan?: GoalPlan, signal?: AbortSignal) {
    if (!this.session.authorized || this.bridgeState.status !== 'connected')
      throw new Error('Enable control using the visible session button first.')
    if (this.runtime.busy) throw new Error('A goal is already active.')
    if (!text.trim() || text.length > 2000) throw new Error('Enter a goal of 1 to 2000 characters.')
    const goal = plan?.goal ?? { id: ulid(), text }
    this.runtimeState.goal = goal
    this.runtimeState.busy = true
    const task = this.runtime.run(goal, plan, signal).finally(() => {
      this.runtimeState.busy = false
    })
    return { goal, task }
  }
  propose(action: ActionRequest, signal?: AbortSignal) {
    const goal = { id: ulid(), text: action.description }
    return this.startGoal(
      goal.text,
      { goal, provider: 'Reviewed direct action', steps: [{ kind: 'action', action }] },
      signal,
    )
  }
  async stop() {
    this.runtime.cancel()
    this.session.authorized = false
    this.bridgeState.status = 'stopped'
    this.approvals.pending = null
    this.runtimeState.proposed = null
    this.event(
      'control.stopped',
      'STOP CONTROL. Pending work cleared and bridge actuation disabled.',
    )
    await this.bridge.emergencyStop().catch(() => {
      this.bridgeState.error = 'Bridge did not acknowledge stop. Use Ctrl+Alt+F10 on Windows.'
    })
  }
  async shareScreen() {
    if (this.runtime.busy) throw new Error('Stop the current goal before sharing another screen.')
    const sharing = this.capture.start()
    this.session.authorized = false
    this.bridgeState.status = 'disconnected'
    await this.bridge.disconnect().catch(() => {})
    await sharing
    this.session.mode = 'live'
    this.screen.sharing = true
    this.screen.geometry = this.capture.getGeometry()
    this.screen.changeRevision = 0
    this.event(
      'capture.started',
      'Screen shared with browser permission. Raw frames stay in memory.',
    )
    await this.observe()
  }
  async pairBridge(code: string) {
    if (!this.screen.sharing || this.session.mode !== 'live')
      throw new Error('Share a screen before pairing the desktop bridge.')
    if (this.runtime.busy) throw new Error('Stop the goal before pairing a bridge.')
    this.session.authorized = false
    this.bridgeState.status = 'connecting'
    this.bridgeState.error = ''
    await this.bridge.disconnect().catch(() => {})
    const bridge = new LocalDesktopBridge(code)
    this.bridge = bridge
    try {
      await bridge.connect()
      const capabilities = await bridge.capabilities()
      if (!this.screen.sharing || this.bridgeState.status !== 'connecting') {
        await bridge.disconnect()
        return
      }
      this.bridgeState.capabilities = capabilities
      this.screen.geometry.desktopBounds = { ...capabilities.desktopBounds }
      this.screen.geometry.displayScale = capabilities.displayScale
      this.screen.geometry.calibrated = false
      this.bridgeState.status = 'connected'
      this.session.authorized = true
      this.runtime = this.makeRuntime()
      this.event(
        'bridge.connected',
        'Local bridge paired for this session. Confirm capture geometry before pointer actions.',
      )
      await this.repository
        .saveSession({ id: this.session.id, createdAt: Date.now(), mode: this.session.mode })
        .catch(() => {})
    } catch (error) {
      this.session.authorized = false
      this.bridgeState.status = 'disconnected'
      await bridge.disconnect().catch(() => {})
      throw error
    }
  }
  async cancelGoal() {
    this.runtime.cancel()
    if (this.session.mode === 'live') await this.stop()
  }
  startRecording() {
    this.recorder.start()
    this.session.recording = true
    this.event(
      'workflow.recording.started',
      'Recording successful Lens actions. Global OS input is not recorded.',
    )
  }
  async stopRecording(name: string) {
    if (this.runtime.busy)
      throw new Error('Wait for the goal to finish or cancel it before ending the recording.')
    try {
      const cartridge = this.recorder.stop(
        name,
        this.screen.observation?.application ?? 'Desktop',
        this.session.mode === 'demo' ? (this.screen.observation?.summary ?? '') : '',
        this.screen.observation?.source ?? 'unavailable',
      )
      await this.saveCartridge(cartridge)
      this.event('cartridge.created', cartridge.name, { cartridgeId: cartridge.id })
      return cartridge
    } finally {
      this.session.recording = false
      this.event('workflow.recording.stopped', 'Workflow recording stopped.')
    }
  }
  async saveCartridge(value: unknown) {
    const cartridge = cartridgeSchema.parse(value)
    await this.repository.saveCartridge(cartridge)
    const index = this.session.cartridges.findIndex((c) => c.id === cartridge.id)
    if (index === -1) this.session.cartridges.push(cartridge)
    else this.session.cartridges[index] = cartridge
    return cartridge
  }
  runCartridge(value: unknown, variables: Record<string, string> = {}) {
    const plan = compileCartridge(value, variables)
    return this.startGoal(plan.goal.text, plan)
  }
  async saveSettings() {
    this.capture.detector.threshold = this.settings.changeThreshold
    await this.repository.saveSettings({
      changeThreshold: this.settings.changeThreshold,
      stepDelay: this.settings.stepDelay,
    })
  }
}
