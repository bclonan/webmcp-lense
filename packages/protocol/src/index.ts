export interface NormalizedPoint {
  x: number
  y: number
}
export interface DesktopPoint {
  x: number
  y: number
}
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
export interface CaptureGeometry {
  captureWidth: number
  captureHeight: number
  desktopBounds: Bounds
  displayScale: number
  calibrated: boolean
}
export interface CapturedFrame {
  id: string
  timestamp: number
  width: number
  height: number
  pixels: ImageData
}
export type RegionRole =
  'button' | 'input' | 'menu' | 'canvas' | 'dialog' | 'text' | 'icon' | 'unknown'
export interface VisualRegion {
  id: string
  role: RegionRole
  label: string
  text: string
  bounds: Bounds
  confidence: number
  consequential?: boolean
}
export interface ScreenObservation {
  id: string
  timestamp: number
  frameSize: { width: number; height: number }
  application?: string
  title?: string
  summary: string
  regions: VisualRegion[]
  source: 'fixture' | 'mock' | 'real provider' | 'unavailable'
  revision: number
}
export type Key =
  | 'WIN'
  | 'ENTER'
  | 'ESC'
  | 'TAB'
  | 'BACKSPACE'
  | 'DELETE'
  | 'CTRL+A'
  | 'CTRL+C'
  | 'CTRL+V'
  | 'CTRL+S'
  | 'ALT+F4'
  | 'CMD+A'
  | 'CMD+C'
  | 'CMD+V'
  | 'CMD+S'
  | 'CMD+W'
  | 'CMD+SPACE'
  | 'LEFT'
  | 'RIGHT'
  | 'UP'
  | 'DOWN'
export type DesktopCommand = { id: string } & (
  | { type: 'pointer.move'; point: DesktopPoint }
  | { type: 'pointer.click'; point: DesktopPoint; button: 'left' | 'right' }
  | { type: 'pointer.drag'; points: DesktopPoint[]; durationMs: number }
  | { type: 'keyboard.text'; text: string }
  | { type: 'keyboard.key'; key: Key }
  | { type: 'scroll'; delta: number }
)
export interface DesktopResult {
  id: string
  ok: boolean
  executedAt: number
  error?: string
}
export interface BridgeCapabilities {
  protocolVersion?: 1
  bridgeVersion?: string
  sessionId?: string
  timestamp?: number
  device?: string
  displayRevision?: string
  keys?: Key[]
  platform: 'mock' | 'windows' | 'macos' | 'linux'
  coordinateSpace?: 'physical-pixels' | 'logical-points'
  desktopBounds: Bounds
  displayScale: number
  commands: DesktopCommand['type'][]
  emergencyStop: boolean
  displays?: { id: string; name: string; bounds: Bounds; primary: boolean }[]
}
export interface DesktopBridge {
  connect(): Promise<void>
  disconnect(): Promise<void>
  capabilities(): Promise<BridgeCapabilities>
  execute(command: DesktopCommand): Promise<DesktopResult>
  emergencyStop(): Promise<void>
}
export type RuntimeState =
  | 'idle'
  | 'observing'
  | 'planning'
  | 'action_proposed'
  | 'policy_check'
  | 'waiting_for_approval'
  | 'executing'
  | 'waiting_for_change'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
export type EventType =
  | 'capture.started'
  | 'capture.stopped'
  | 'screen.observed'
  | 'goal.started'
  | 'goal.cancelled'
  | 'action.proposed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'action.executed'
  | 'screen.changed'
  | 'action.verified'
  | 'goal.completed'
  | 'goal.failed'
  | 'workflow.recording.started'
  | 'workflow.recording.stopped'
  | 'workflow.annotated'
  | 'cartridge.created'
  | 'runtime.transition'
  | 'bridge.connected'
  | 'bridge.disconnected'
  | 'control.stopped'
export interface RuntimeEvent {
  id: string
  sessionId: string
  timestamp: number
  type: EventType
  message: string
  data?: Record<string, unknown>
}
export interface ActionRequest {
  type: DesktopCommand['type']
  targetId?: string
  point?: NormalizedPoint
  points?: NormalizedPoint[]
  text?: string
  key?: Key
  delta?: number
  button?: 'left' | 'right'
  durationMs?: number
  description: string
  consequential?: boolean
}
export interface Goal {
  id: string
  text: string
}
export type PlanStep =
  | { kind: 'action'; action: ActionRequest; expected?: string }
  | { kind: 'assert' | 'waitFor' | 'locate'; text: string }
export interface GoalPlan {
  goal: Goal
  steps: PlanStep[]
  provider: string
}
export interface PlannerProvider {
  plan(goal: Goal, observation: ScreenObservation): Promise<GoalPlan>
}
export type PolicyDecision = { decision: 'ALLOW' | 'ASK' | 'BLOCK'; reason: string }
export interface PendingApproval {
  id: string
  action: ActionRequest
  reason: string
}
export interface CartridgeStep {
  type: 'locate' | 'click' | 'type' | 'press' | 'scroll' | 'drag' | 'waitFor' | 'assert'
  targetId?: string
  point?: NormalizedPoint
  points?: NormalizedPoint[]
  text?: string
  key?: Key
  delta?: number
  button?: 'left' | 'right'
  durationMs?: number
  approval?: boolean
}
export interface CapabilityCartridge {
  version: 1
  id: string
  name: string
  description: string
  application: string
  inputs: Record<string, string>
  steps: CartridgeStep[]
  assertions: string[]
  approvalRequirements: string[]
  metadata: { createdAt: number; observationSource: string; author: string; notes?: string[] }
}
