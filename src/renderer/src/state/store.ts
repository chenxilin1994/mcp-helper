import { useSyncExternalStore } from 'react'
import type {
  AppState,
  Capabilities,
  ConnectionStatus,
  LogLine,
  PromptResult,
  ResourceReadResult,
  ToolCallResult
} from '@shared/types'
import type { MenuItem } from '../components/primitives'

export type TabId = 'overview' | 'caps' | 'logs' | 'json'
export type CapKind = 'tools' | 'resources' | 'prompts'
export type ViewMode = 'home' | 'detail' | 'create' | 'edit'
export type DialogId = 'import' | 'settings' | null

export interface ViewState {
  mode: ViewMode
  serverId: string | null
  tab: TabId
  capKind: CapKind
  capItem: string | null
  autorun: boolean
}

export type RunResult =
  | { kind: 'tool'; at: number; name: string; result: ToolCallResult }
  | { kind: 'resource'; at: number; uri: string; result: ResourceReadResult }
  | { kind: 'prompt'; at: number; name: string; result: PromptResult }

export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
  action?: { label: string; onAction: () => void }
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export interface ProbeStageState {
  status: 'pending' | 'active' | 'done' | 'fail'
  ms?: number
  detail?: string
}

export interface ProbeState {
  at: number
  running: boolean
  stages: Record<string, ProbeStageState>
}

export interface ConfirmState {
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export interface CapsState {
  loading: boolean
  error?: string
  data?: Capabilities
  at?: number
}

export interface RuntimeState {
  status: ConnectionStatus
  error?: string
  testing?: boolean
}

export interface GroupEditorState {
  id?: string
  name: string
  color: string
}

export interface UIState {
  ready: boolean
  app: AppState | null
  view: ViewState
  dialog: DialogId
  search: string
  groupFilter: string
  runtime: Record<string, RuntimeState>
  logs: Record<string, LogLine[]>
  caps: Record<string, CapsState>
  runs: Record<string, RunResult[]>
  probe: Record<string, ProbeState>
  toasts: Toast[]
  confirm: ConfirmState | null
  contextMenu: ContextMenuState | null
  groupEditor: GroupEditorState | null
  busy: Record<string, boolean>
  capture: boolean
}

const initialView: ViewState = {
  mode: 'home',
  serverId: null,
  tab: 'overview',
  capKind: 'tools',
  capItem: null,
  autorun: false
}

export const initialState: UIState = {
  ready: false,
  app: null,
  view: initialView,
  dialog: null,
  search: '',
  groupFilter: 'all',
  runtime: {},
  logs: {},
  caps: {},
  runs: {},
  probe: {},
  toasts: [],
  confirm: null,
  contextMenu: null,
  groupEditor: null,
  busy: {},
  capture: typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('capture')
}

type Listener = () => void

let state: UIState = initialState
const listeners = new Set<Listener>()

export function getState(): UIState {
  return state
}

export function setState(patch: Partial<UIState> | ((current: UIState) => Partial<UIState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStore(): UIState {
  return useSyncExternalStore(subscribe, getState, getState)
}

let toastSeq = 0

export function pushToast(toast: Omit<Toast, 'id'>, options?: { duration?: number }): void {
  const id = ++toastSeq
  setState((current) => ({ toasts: [...current.toasts, { ...toast, id }] }))
  const duration = options?.duration ?? (toast.kind === 'error' ? 6500 : 3600)
  window.setTimeout(() => {
    setState((current) => ({ toasts: current.toasts.filter((item) => item.id !== id) }))
  }, duration)
}

export function dismissToast(id: number): void {
  setState((current) => ({ toasts: current.toasts.filter((item) => item.id !== id) }))
}

export function patchRuntime(serverId: string, patch: Partial<RuntimeState>): void {
  setState((current) => {
    const existing: RuntimeState = current.runtime[serverId] ?? { status: 'disconnected' }
    return { runtime: { ...current.runtime, [serverId]: { ...existing, ...patch } } }
  })
}

export function appendLog(serverId: string, entry: LogLine): void {
  setState((current) => {
    const existing = current.logs[serverId] ?? []
    const next = [...existing, entry]
    return { logs: { ...current.logs, [serverId]: next.length > 500 ? next.slice(-500) : next } }
  })
}

export function pushRun(serverId: string, run: RunResult): void {
  setState((current) => {
    const existing = current.runs[serverId] ?? []
    const next = [run, ...existing]
    return { runs: { ...current.runs, [serverId]: next.slice(0, 20) } }
  })
}

export function setCaps(serverId: string, patch: Partial<CapsState>): void {
  setState((current) => {
    const existing: CapsState = current.caps[serverId] ?? { loading: false }
    return { caps: { ...current.caps, [serverId]: { ...existing, ...patch } } }
  })
}

export function setBusy(key: string, value: boolean): void {
  setState((current) => ({ busy: { ...current.busy, [key]: value } }))
}

export function applyProbeEvent(
  serverId: string,
  stage: string,
  status: 'active' | 'done' | 'fail',
  ms?: number,
  detail?: string
): void {
  setState((current) => {
    const previous = current.probe[serverId]
    const base: ProbeState =
      status === 'active'
        ? {
            at: Date.now(),
            running: true,
            stages: { link: { status: 'pending' }, handshake: { status: 'pending' }, ping: { status: 'pending' } }
          }
        : previous ?? { at: Date.now(), running: false, stages: {} }
    const stages = { ...base.stages, [stage]: { status, ms, detail } }
    const running = status === 'active' ? true : status === 'fail' ? false : stage === 'link' ? false : base.running
    return { probe: { ...current.probe, [serverId]: { ...base, stages, running } } }
  })
}

export function openContextMenu(x: number, y: number, items: MenuItem[]): void {
  setState({ contextMenu: { x, y, items } })
}

export function closeContextMenu(): void {
  if (getState().contextMenu) setState({ contextMenu: null })
}
