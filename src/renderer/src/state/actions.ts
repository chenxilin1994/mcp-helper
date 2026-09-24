import type {
  ImportedServer,
  MCPEvent,
  MCPGroup,
  MCPServerConfig,
  ParseResult,
  PromptResult,
  ResourceReadResult,
  ServerDraft,
  Settings,
  TestResult,
  ThemeMode,
  ToolCallResult
} from '@shared/types'
import { DEFAULT_SHORTCUTS, ZOOM_LEVELS, type ShortcutAction } from '@shared/shortcuts'
import {
  appendLog,
  applyProbeEvent,
  getState,
  patchRuntime,
  pushRun,
  pushToast,
  setBusy,
  setCaps,
  setState,
  type CapKind,
  type RunResult,
  type RuntimeState,
  type TabId,
  type ViewState
} from './store'
import { hashFor, navigateHash, parseRoute } from './router'
import { selectVisibleServers } from './selectors'
import { acceleratorFromEvent, findActionForEvent } from '../lib/shortcuts'
import { formatLatency } from '../lib/format'

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  return '未知错误'
}

function viewOf(serverId: string, patch?: Partial<ViewState>): ViewState {
  return { mode: 'detail', serverId, tab: 'overview', capKind: 'tools', capItem: null, autorun: false, ...patch }
}

function sameView(a: ViewState, b: ViewState): boolean {
  return (
    a.mode === b.mode &&
    a.serverId === b.serverId &&
    a.tab === b.tab &&
    a.capKind === b.capKind &&
    a.capItem === b.capItem &&
    a.autorun === b.autorun
  )
}

export function goTo(view: ViewState, options?: { replace?: boolean }): void {
  setState({ view })
  navigateHash(hashFor(view), options)
}

export function applyRoute(): void {
  const route = parseRoute(window.location.hash)
  const current = getState()
  if (!sameView(current.view, route.view) || current.dialog !== route.dialog) {
    setState({ view: route.view, dialog: route.dialog })
  }
}

export function openServer(id: string, patch?: Partial<ViewState>): void {
  goTo(viewOf(id, patch))
}

export function setTab(id: string, tab: TabId): void {
  const current = getState().view
  goTo(viewOf(id, { tab, capKind: current.serverId === id ? current.capKind : 'tools', capItem: current.serverId === id ? current.capItem : null }))
}

export function openDialog(dialog: 'import' | 'settings'): void {
  setState({ dialog })
  navigateHash(dialog === 'import' ? '#/import' : '#/settings')
}

export function closeDialog(): void {
  setState({ dialog: null })
  navigateHash(hashFor(getState().view), { replace: true })
}

export function setSearch(search: string): void {
  setState({ search })
}

export function setGroupFilter(groupFilter: string): void {
  setState({ groupFilter })
}

export async function bootstrap(): Promise<void> {
  const route = parseRoute(window.location.hash)
  const bareHome = !window.location.hash || window.location.hash === '#/'
  try {
    const [app, snapshot] = await Promise.all([window.api.getState(), window.api.snapshot()])
    const runtime: Record<string, RuntimeState> = {}
    for (const [id, status] of Object.entries(snapshot.statuses)) runtime[id] = { status }
    setState({ app, runtime, logs: snapshot.logs, ready: true, view: route.view, dialog: route.dialog })
    applyAppearance(app.settings)
    if (bareHome && app.servers.length) {
      const first = [...app.servers].sort((a, b) =>
        a.favorite !== b.favorite ? (a.favorite ? -1 : 1) : a.name.localeCompare(b.name, 'zh-Hans-CN')
      )[0]
      goTo(viewOf(first.id), { replace: true })
    }
  } catch (error) {
    setState({ ready: true })
    pushToast({ kind: 'error', title: '初始化失败', message: messageOf(error) })
  }
  window.api.onEvent(handleEvent)
  window.addEventListener('hashchange', applyRoute)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const settings = getState().app?.settings
    if (settings && settings.theme === 'system') applyAppearance(settings)
  })
}

function handleEvent(event: MCPEvent): void {
  if (event.type === 'status') {
    const testing = event.status === 'connecting'
    patchRuntime(event.serverId, {
      status: event.status,
      error: event.status === 'error' ? event.error : undefined,
      testing
    })
    if (event.status !== 'connecting') {
      const probe = getState().probe[event.serverId]
      if (probe?.running) {
        applyProbeEvent(event.serverId, 'link', event.status === 'error' ? 'fail' : 'done')
      }
    }
  } else if (event.type === 'probe') {
    applyProbeEvent(event.serverId, event.stage, event.status, event.ms, event.detail)
  } else {
    appendLog(event.serverId, event.entry)
  }
}

export function applyAppearance(settings: Settings): void {
  const root = document.documentElement
  const resolved =
    settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : settings.theme
  root.dataset.theme = resolved
  root.dataset.palette = settings.palette
  root.dataset.uifont = settings.uiFont
  root.dataset.monofont = settings.monoFont
  root.style.setProperty('--font-scale', String(settings.fontScale))
}

export function focusSearch(): void {
  const input = document.querySelector<HTMLInputElement>('.search__input')
  input?.focus()
  input?.select()
}

export async function setZoom(value: number): Promise<void> {
  const clamped = Math.min(1.5, Math.max(0.8, value))
  const nearest = ZOOM_LEVELS.reduce(
    (best, level) => (Math.abs(level.value - clamped) < Math.abs(best - clamped) ? level.value : best),
    ZOOM_LEVELS[2].value
  )
  await saveSettings({ zoom: nearest })
}

function stepServer(direction: 1 | -1): void {
  const state = getState()
  const servers = selectVisibleServers(state)
  if (!servers.length) return
  const index = servers.findIndex((server) => server.id === state.view.serverId)
  const target = servers[index < 0 ? 0 : Math.min(servers.length - 1, Math.max(0, index + direction))]
  if (target) openServer(target.id)
}

export function runShortcutAction(action: ShortcutAction): void {
  const state = getState()
  const current = state.view.serverId

  switch (action) {
    case 'newServer':
      goTo({ mode: 'create', serverId: null, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
      break
    case 'search':
      focusSearch()
      break
    case 'nextServer':
      stepServer(1)
      break
    case 'prevServer':
      stepServer(-1)
      break
    case 'openImport':
      openDialog('import')
      break
    case 'openSettings':
      openDialog('settings')
      break
    case 'testCurrent':
      if (current) void testServer(current)
      break
    case 'testAll':
      void testAll()
      break
    case 'editCurrent':
      if (current) {
        goTo({ mode: 'edit', serverId: current, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
      }
      break
    case 'toggleFavorite':
      if (current) void toggleFavorite(current)
      break
    case 'tabOverview':
    case 'tabCaps':
    case 'tabLogs':
    case 'tabJson': {
      if (!current) break
      const tab = action === 'tabOverview' ? 'overview' : action === 'tabCaps' ? 'caps' : action === 'tabLogs' ? 'logs' : 'json'
      setTab(current, tab)
      break
    }
    case 'zoomIn':
      void setZoom((state.app?.settings.zoom ?? 1) + 0.1)
      break
    case 'zoomOut':
      void setZoom((state.app?.settings.zoom ?? 1) - 0.1)
      break
    case 'zoomReset':
      void setZoom(1)
      break
  }
}

export function handleShortcutEvent(event: KeyboardEvent): boolean {
  const shortcuts = getState().app?.settings.shortcuts
  const action = findActionForEvent(event, shortcuts)
  if (!action) return false

  const target = event.target as HTMLElement | null
  const typing = Boolean(
    target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
  )
  const accelerator = acceleratorFromEvent(event) ?? ''
  const hasModifier = accelerator.includes('Ctrl') || accelerator.includes('Alt')
  if (typing && !hasModifier) return false

  runShortcutAction(action)
  return true
}

export function shortcutHint(action: ShortcutAction): string {
  const shortcuts = getState().app?.settings.shortcuts
  const value = shortcuts?.[action]
  return (value === undefined ? DEFAULT_SHORTCUTS[action] : value).replace(/\+/g, ' + ')
}

export function clearCapsCache(serverId: string): void {
  const caps = { ...getState().caps }
  delete caps[serverId]
  setState({ caps })
}

export async function saveServer(draft: ServerDraft, options?: { test?: boolean }): Promise<string | null> {
  setBusy('save:server', true)
  try {
    const previousIds = new Set(getState().app?.servers.map((server) => server.id) ?? [])
    const app = await window.api.saveServer(draft)
    setState({ app })
    const savedId = draft.id ?? app.servers.find((server) => !previousIds.has(server.id))?.id ?? null
    if (draft.id) clearCapsCache(draft.id)
    if (savedId) goTo(viewOf(savedId))
    pushToast({ kind: 'success', title: draft.id ? '已保存修改' : '已创建 MCP', message: draft.name })
    if (options?.test && savedId) await testServer(savedId)
    return savedId
  } catch (error) {
    pushToast({ kind: 'error', title: '保存失败', message: messageOf(error) })
    return null
  } finally {
    setBusy('save:server', false)
  }
}

export async function duplicateServer(id: string): Promise<void> {
  const server = getState().app?.servers.find((item) => item.id === id)
  if (!server) return
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, lastTest: _lastTest, ...rest } = server
  await saveServer({ ...rest, name: `${server.name} 副本` })
}

export function deleteServer(id: string): void {
  const server = getState().app?.servers.find((item) => item.id === id)
  if (!server) return
  setState({
    confirm: {
      title: `删除「${server.name}」？`,
      message: '配置与测试记录会从本机移除。删除后 8 秒内可以撤销。',
      confirmLabel: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          const app = await window.api.deleteServer(id)
          setState({ app })
          goTo({ mode: 'home', serverId: null, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
          pushToast(
            {
              kind: 'info',
              title: `已删除「${server.name}」`,
              action: { label: '撤销', onAction: () => void undoDelete() }
            },
            { duration: 8000 }
          )
        } catch (error) {
          pushToast({ kind: 'error', title: '删除失败', message: messageOf(error) })
        }
      }
    }
  })
}

export async function undoDelete(): Promise<void> {
  try {
    const app = await window.api.undoDelete()
    setState({ app })
    pushToast({ kind: 'success', title: '已恢复删除的 MCP' })
  } catch (error) {
    pushToast({ kind: 'error', title: '撤销失败', message: messageOf(error) })
  }
}

export async function toggleFavorite(id: string): Promise<void> {
  const server = getState().app?.servers.find((item) => item.id === id)
  if (!server) return
  try {
    const app = await window.api.patchServer({ id, patch: { favorite: !server.favorite } })
    setState({ app })
  } catch (error) {
    pushToast({ kind: 'error', title: '操作失败', message: messageOf(error) })
  }
}

export async function toggleEnabled(id: string): Promise<void> {
  const server = getState().app?.servers.find((item) => item.id === id)
  if (!server) return
  try {
    const app = await window.api.patchServer({ id, patch: { enabled: !server.enabled } })
    setState({ app })
    pushToast({ kind: 'info', title: server.enabled ? '已停用' : '已启用', message: server.name })
  } catch (error) {
    pushToast({ kind: 'error', title: '操作失败', message: messageOf(error) })
  }
}

export async function testServer(id: string, options?: { silent?: boolean }): Promise<TestResult | null> {
  const server = getState().app?.servers.find((item) => item.id === id)
  patchRuntime(id, { testing: true })
  try {
    const result = await window.api.test(id)
    patchRuntime(id, {
      testing: false,
      status: result.status === 'ok' ? 'ready' : 'error',
      error: result.status === 'ok' ? undefined : result.error
    })
    const app = getState().app
    if (app) {
      setState({
        app: {
          ...app,
          servers: app.servers.map((item) => (item.id === id ? { ...item, lastTest: result } : item))
        }
      })
    }
    if (!options?.silent) {
      if (result.status === 'ok') {
        pushToast({
          kind: 'success',
          title: `「${server?.name ?? ''}」连接正常`,
          message: `总耗时 ${formatLatency(result.latencyMs)}`
        })
      } else {
        pushToast({ kind: 'error', title: `「${server?.name ?? ''}」连接失败`, message: result.error ?? '未知错误' })
      }
    }
    return result
  } catch (error) {
    patchRuntime(id, { testing: false, status: 'error', error: messageOf(error) })
    if (!options?.silent) pushToast({ kind: 'error', title: '测试失败', message: messageOf(error) })
    return null
  }
}

export async function testAll(): Promise<void> {
  const servers = getState().app?.servers ?? []
  if (!servers.length) {
    pushToast({ kind: 'info', title: '还没有 MCP 可测试' })
    return
  }
  setBusy('test:all', true)
  const queue = [...servers]
  let ok = 0
  let failed = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const server = queue.shift()
      if (!server) return
      const result = await testServer(server.id, { silent: true })
      if (result?.status === 'ok') ok += 1
      else failed += 1
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, servers.length) }, worker))
  setBusy('test:all', false)
  if (failed) pushToast({ kind: 'error', title: `测试完成：${ok} 个正常，${failed} 个异常`, message: '失败详情见各服务器面板' })
  else pushToast({ kind: 'success', title: `全部连通，共 ${ok} 个服务器` })
}

export async function connectServer(id: string): Promise<void> {
  patchRuntime(id, { testing: true })
  try {
    await window.api.connect(id)
    patchRuntime(id, { testing: false, status: 'ready', error: undefined })
  } catch (error) {
    patchRuntime(id, { testing: false, status: 'error', error: messageOf(error) })
    pushToast({ kind: 'error', title: '连接失败', message: messageOf(error) })
  }
}

export async function disconnectServer(id: string): Promise<void> {
  try {
    await window.api.disconnect(id)
    patchRuntime(id, { status: 'disconnected', error: undefined, testing: false })
    pushToast({ kind: 'info', title: '已断开连接' })
  } catch (error) {
    pushToast({ kind: 'error', title: '断开失败', message: messageOf(error) })
  }
}

export async function loadCaps(id: string, force = false): Promise<void> {
  const current = getState().caps[id]
  if (!force && (current?.loading || current?.data)) return
  setCaps(id, { loading: true, error: undefined })
  try {
    const data = await window.api.capabilities(id)
    setCaps(id, { loading: false, data, at: Date.now(), error: undefined })
    patchRuntime(id, { status: 'ready', error: undefined })
  } catch (error) {
    setCaps(id, { loading: false, error: messageOf(error) })
  }
}

export async function runTool(serverId: string, name: string, args: Record<string, unknown>): Promise<ToolCallResult | null> {
  setBusy(`run:${serverId}:${name}`, true)
  try {
    const result = await window.api.callTool({ id: serverId, name, args })
    pushRun(serverId, { kind: 'tool', at: Date.now(), name, result })
    return result
  } catch (error) {
    pushToast({ kind: 'error', title: `${name} 调用失败`, message: messageOf(error) })
    return null
  } finally {
    setBusy(`run:${serverId}:${name}`, false)
  }
}

export async function runResource(serverId: string, uri: string): Promise<ResourceReadResult | null> {
  setBusy(`run:${serverId}:${uri}`, true)
  try {
    const result = await window.api.readResource({ id: serverId, uri })
    pushRun(serverId, { kind: 'resource', at: Date.now(), uri, result })
    return result
  } catch (error) {
    pushToast({ kind: 'error', title: '读取资源失败', message: messageOf(error) })
    return null
  } finally {
    setBusy(`run:${serverId}:${uri}`, false)
  }
}

export async function runPrompt(serverId: string, name: string, args: Record<string, string>): Promise<PromptResult | null> {
  setBusy(`run:${serverId}:${name}`, true)
  try {
    const result = await window.api.getPrompt({ id: serverId, name, args })
    pushRun(serverId, { kind: 'prompt', at: Date.now(), name, result })
    return result
  } catch (error) {
    pushToast({ kind: 'error', title: `获取提示词失败`, message: messageOf(error) })
    return null
  } finally {
    setBusy(`run:${serverId}:${name}`, false)
  }
}

export function clearRuns(serverId: string): void {
  setState((current) => {
    const runs = { ...current.runs }
    delete runs[serverId]
    return { runs }
  })
}

export function clearLogs(serverId: string): void {
  setState((current) => ({ logs: { ...current.logs, [serverId]: [] } }))
}

export function openGroupEditor(group?: MCPGroup): void {
  setState({
    groupEditor: { id: group?.id, name: group?.name ?? '', color: group?.color ?? 'blue' }
  })
}

export function closeGroupEditor(): void {
  setState({ groupEditor: null })
}

export async function submitGroup(input: { id?: string; name: string; color: string }): Promise<void> {
  try {
    const app = await window.api.saveGroup(input)
    setState({ app, groupEditor: null })
    pushToast({ kind: 'success', title: input.id ? '分组已更新' : '分组已创建', message: input.name })
  } catch (error) {
    pushToast({ kind: 'error', title: '保存分组失败', message: messageOf(error) })
  }
}

export function deleteGroup(id: string): void {
  const group = getState().app?.groups.find((item) => item.id === id)
  if (!group) return
  setState({
    confirm: {
      title: `删除分组「${group.name}」?`,
      message: '分组中的 MCP 会移到「未分组」，不会被删除。',
      confirmLabel: '删除分组',
      danger: true,
      onConfirm: async () => {
        try {
          const app = await window.api.deleteGroup(id)
          setState({ app, groupFilter: getState().groupFilter === id ? 'all' : getState().groupFilter })
          pushToast({ kind: 'success', title: '分组已删除', message: group.name })
        } catch (error) {
          pushToast({ kind: 'error', title: '删除失败', message: messageOf(error) })
        }
      }
    }
  })
}

export async function moveGroup(id: string, direction: -1 | 1): Promise<void> {
  const groups = [...(getState().app?.groups ?? [])].sort((a, b) => a.order - b.order)
  const index = groups.findIndex((group) => group.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= groups.length) return
  const next = [...groups]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  try {
    const app = await window.api.reorderGroups(next.map((group) => group.id))
    setState({ app })
  } catch (error) {
    pushToast({ kind: 'error', title: '排序失败', message: messageOf(error) })
  }
}

export async function parseImportSource(payload: { clientId?: string; json?: string }): Promise<ParseResult | null> {
  try {
    return await window.api.parseImport(payload)
  } catch (error) {
    pushToast({ kind: 'error', title: '解析失败', message: messageOf(error) })
    return null
  }
}

export async function importServers(servers: ImportedServer[], groupName?: string): Promise<boolean> {
  try {
    const app = await window.api.importServers({ servers, groupName })
    setState({ app })
    pushToast({ kind: 'success', title: `已导入 ${servers.length} 个 MCP` })
    return true
  } catch (error) {
    pushToast({ kind: 'error', title: '导入失败', message: messageOf(error) })
    return false
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  try {
    const app = await window.api.saveSettings(patch)
    setState({ app })
    applyAppearance(app.settings)
  } catch (error) {
    pushToast({ kind: 'error', title: '保存设置失败', message: messageOf(error) })
  }
}

export function resolveConfirm(): void {
  const confirm = getState().confirm
  if (!confirm) return
  setState({ confirm: null })
  void confirm.onConfirm()
}

export function dismissConfirm(): void {
  setState({ confirm: null })
}

export type { RunResult, CapKind }
export type { MCPServerConfig }
