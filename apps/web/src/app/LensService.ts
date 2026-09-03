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
import { BridgeError, errorMessage } from '../bridge/errors'
import { CartridgeService, compileCartridge, starterCartridge } from '../workflows/CartridgeService'
import { cartridgeSchema, sequenceSchema } from '@lens/schemas'
import { createTools } from '../webmcp/tools'
import { BrowserCapabilities } from '../browser/BrowserCapabilities'
const eventId = monotonicFactory()
export class LensService {
  private pairing = false
  private stopping = false
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
  readonly browser = new BrowserCapabilities()
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
      progress: (step, total) => {
        this.runtimeState.step = step
        this.runtimeState.total = total
      },
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
    if (type === 'goal.failed') {
      this.runtimeState.failure = message
      if (this.session.mode === 'live' && data?.bridgeFailure) void this.connectionLost(message)
    }
    if (type === 'goal.cancelled' && data?.duringExecution && this.session.mode === 'live')
      void this.stop()
  }
  requestSetup(reason = '') {
    this.session.setupReason = reason
    this.session.setupOpen = true
  }
  private async connectionLost(reason: string) {
    if (this.runtime.state !== 'failed') this.runtime.cancel()
    this.session.authorized = false
    this.bridgeState.status = 'disconnected'
    this.bridgeState.expiresAt = 0
    this.requestSetup(reason)
    await this.bridge.emergencyStop().catch(() => {
      this.bridgeState.error = 'Bridge connection lost. Use Ctrl+Alt+F10 to stop native input.'
    })
  }
  async checkConnection() {
    if (
      this.session.mode !== 'live' ||
      this.bridgeState.status !== 'connected' ||
      this.runtime.busy
    )
      return
    const bridge = this.bridge
    try {
      const capabilities = await bridge.capabilities()
      if (bridge !== this.bridge || this.bridgeState.status !== 'connected' || this.runtime.busy)
        return
      this.bridgeState.latencyMs = bridge instanceof LocalDesktopBridge ? bridge.latencyMs : 0
      this.bridgeState.testedAt = Date.now()
      if (
        JSON.stringify(capabilities.desktopBounds) !==
          JSON.stringify(this.bridgeState.capabilities?.desktopBounds) ||
        JSON.stringify(capabilities.displays) !==
          JSON.stringify(this.bridgeState.capabilities?.displays)
      ) {
        this.screen.geometry.calibrated = false
        this.bridgeState.capabilities = capabilities
        this.requestSetup('Your display arrangement changed. Confirm the shared monitor again.')
      }
    } catch (error) {
      if (bridge === this.bridge && this.bridgeState.status === 'connected')
        await this.connectionLost(
          `${errorMessage(error)} Click New pairing code in Lens Bridge, then pair again.`,
        )
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
    if (!this.session.authorized || this.bridgeState.status !== 'connected') {
      if (this.session.mode === 'live')
        this.requestSetup('Pair the desktop before running this action.')
      throw new Error('Enable control using the visible session button first.')
    }
    if (this.runtime.busy) throw new Error('A goal is already active.')
    if (
      this.session.mode === 'live' &&
      (!this.screen.sharing || !this.screen.geometry.calibrated)
    ) {
      this.requestSetup('Share your screen and confirm its monitor before running actions.')
      throw new Error('Complete desktop setup first.')
    }
    if (this.session.mode === 'live' && !plan)
      throw new Error('Live actions need explicit steps. Use a sequence or a recorded workflow.')
    if (!text.trim() || text.length > 2000) throw new Error('Enter a goal of 1 to 2000 characters.')
    plan = plan ? JSON.parse(JSON.stringify(plan)) : undefined
    this.runtimeState.lastRun = { text, plan, mode: this.session.mode }
    this.runtimeState.failure = ''
    this.runtimeState.step = 0
    this.runtimeState.total = plan?.steps.length ?? 0
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
  runSequence(value: unknown, signal?: AbortSignal) {
    const sequence = sequenceSchema.parse(value)
    const plan = compileCartridge(
      {
        version: 1,
        id: ulid(),
        name: sequence.name,
        description: 'Reviewed action sequence',
        application: 'Desktop',
        inputs: {},
        steps: sequence.steps,
        assertions: [],
        approvalRequirements: [],
        metadata: {
          createdAt: Date.now(),
          observationSource: this.screen.observation?.source ?? 'unavailable',
          author: 'Local session',
        },
      },
      {},
    )
    return this.startGoal(plan.goal.text, plan, signal)
  }
  rerunLast(signal?: AbortSignal) {
    const previous = this.runtimeState.lastRun
    if (!previous || previous.mode !== this.session.mode)
      throw new Error('No run is available for this desktop.')
    const plan = previous.plan ? (JSON.parse(JSON.stringify(previous.plan)) as GoalPlan) : undefined
    if (plan) plan.goal.id = ulid()
    return this.startGoal(previous.text, plan, signal)
  }
  async stop() {
    if (this.stopping) return
    this.stopping = true
    try {
      this.runtime.cancel()
      this.browser.denyCopy()
      this.session.authorized = false
      this.bridgeState.expiresAt = 0
      this.session.setupOpen = false
      this.bridgeState.status = 'stopped'
      this.approvals.pending = null
      this.runtimeState.proposed = null
      this.event(
        'control.stopped',
        'STOP CONTROL. Pending work cleared and bridge actuation disabled.',
      )
      await this.bridge.emergencyStop().catch(() => {
        this.bridgeState.error =
          'Bridge did not acknowledge stop. Use Ctrl+Alt+F10, or type stop in the companion terminal.'
      })
    } finally {
      this.stopping = false
    }
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
    this.requestSetup()
    this.event(
      'capture.started',
      'Screen shared with browser permission. Raw frames stay in memory.',
    )
    await this.observe()
  }
  async pairBridge(code: string) {
    if (this.pairing) throw new Error('Pairing is already in progress.')
    if (this.bridgeState.status === 'connected') return
    if (!this.screen.sharing || this.session.mode !== 'live')
      throw new Error('Share a screen before pairing the desktop bridge.')
    if (this.runtime.busy) throw new Error('Stop the goal before pairing a bridge.')
    this.pairing = true
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
      const saved = this.savedMapping()
      if (saved) this.screen.geometry.desktopBounds = saved
      this.screen.geometry.displayScale = capabilities.displayScale
      this.screen.geometry.calibrated = false
      this.bridgeState.status = 'connected'
      this.bridgeState.expiresAt = bridge.expiresAt
      this.bridgeState.latencyMs = bridge.latencyMs
      this.bridgeState.testedAt = Date.now()
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
      this.bridgeState.expiresAt = 0
      this.bridgeState.capabilities = null
      this.screen.geometry.calibrated = false
      await bridge.disconnect().catch(() => {})
      const message = errorMessage(error)
      const recovery = bridge.expiresAt
        ? `${message} The connection could not finish. Click New pairing code in Lens Bridge and pair again.`
        : message
      this.bridgeState.error = recovery
      throw new BridgeError(
        error instanceof BridgeError ? error.code : 'connection_failed',
        recovery,
      )
    } finally {
      this.pairing = false
    }
  }
  private savedMapping() {
    try {
      const value = JSON.parse(localStorage.getItem('lens.capture-mapping') ?? 'null')
      const b = this.bridgeState.capabilities?.desktopBounds
      if (value && b && this.mappingFits(value, b)) return value
    } catch {
      /* Geometry is optional; authorization is never stored. */
    }
    return null
  }
  private mappingFits(m: import('@lens/protocol').Bounds, b: import('@lens/protocol').Bounds) {
    return (
      [m.x, m.y, m.width, m.height].every(Number.isInteger) &&
      m.width >= 2 &&
      m.height >= 2 &&
      m.x >= b.x &&
      m.y >= b.y &&
      m.x + m.width <= b.x + b.width &&
      m.y + m.height <= b.y + b.height
    )
  }
  confirmMapping() {
    const g = this.screen.geometry,
      b = this.bridgeState.capabilities?.desktopBounds
    if (
      this.runtime.busy ||
      !this.screen.sharing ||
      this.bridgeState.status !== 'connected' ||
      !b ||
      !this.mappingFits(g.desktopBounds, b)
    )
      throw new Error('Choose a monitor or enter capture bounds inside the reported desktop.')
    const captureRatio = g.captureWidth / g.captureHeight
    const mappedRatio = g.desktopBounds.width / g.desktopBounds.height
    if (Math.abs(captureRatio - mappedRatio) / captureRatio > 0.05)
      throw new Error(
        'The mapping shape does not match the shared image. Choose the single monitor you shared.',
      )
    g.calibrated = true
    try {
      localStorage.setItem('lens.capture-mapping', JSON.stringify(g.desktopBounds))
    } catch {
      /* Optional convenience. */
    }
    this.session.setupReason = ''
  }
  async cancelGoal() {
    this.runtime.cancel()
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
