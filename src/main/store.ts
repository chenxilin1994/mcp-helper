import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AppState, MCPGroup, MCPServerConfig, ServerDraft, Settings, TestResult } from '../shared/types'
import { DEFAULT_SHORTCUTS, type ShortcutAction } from '../shared/shortcuts'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'signal',
  uiFont: 'system',
  monoFont: 'cascadia',
  fontScale: 1,
  zoom: 1,
  connectTimeoutMs: 30_000,
  callTimeoutMs: 60_000,
  shortcuts: {}
}

function defaultState(): AppState {
  return { version: 1, servers: [], groups: [], settings: { ...DEFAULT_SETTINGS } }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined || val === null) continue
    out[key] = typeof val === 'string' ? val : String(val)
  }
  return out
}

function normalize(input: unknown): AppState {
  const base = defaultState()
  if (!input || typeof input !== 'object') return base
  const raw = input as Record<string, unknown>

  const groups: MCPGroup[] = Array.isArray(raw.groups)
    ? (raw.groups as Record<string, unknown>[]).map((g, index) => ({
        id: asString(g.id) || randomUUID(),
        name: asString(g.name, '未命名分组'),
        color: asString(g.color, 'blue'),
        order: typeof g.order === 'number' ? g.order : index
      }))
    : []

  const groupIds = new Set(groups.map((g) => g.id))

  const servers: MCPServerConfig[] = Array.isArray(raw.servers)
    ? (raw.servers as Record<string, unknown>[]).map((s) => {
        const transport = s.transport === 'sse' || s.transport === 'http' ? s.transport : 'stdio'
        const groupId = typeof s.groupId === 'string' && groupIds.has(s.groupId) ? s.groupId : null
        return {
          id: asString(s.id) || randomUUID(),
          name: asString(s.name, '未命名 MCP'),
          description: asString(s.description),
          groupId,
          enabled: s.enabled !== false,
          favorite: s.favorite === true,
          transport,
          command: asString(s.command),
          args: Array.isArray(s.args) ? s.args.map((a) => String(a)) : [],
          env: asStringRecord(s.env),
          cwd: asString(s.cwd),
          url: asString(s.url),
          headers: asStringRecord(s.headers),
          createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
          updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
          lastTest: s.lastTest && typeof s.lastTest === 'object' ? (s.lastTest as TestResult) : undefined
        }
      })
    : []

  const settings = { ...DEFAULT_SETTINGS }
  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings as Record<string, unknown>
    if (s.theme === 'dark' || s.theme === 'light' || s.theme === 'system') settings.theme = s.theme
    if (typeof s.palette === 'string' && ['signal', 'deep', 'moss', 'plum', 'ember', 'mono'].includes(s.palette)) {
      settings.palette = s.palette as Settings['palette']
    }
    if (typeof s.uiFont === 'string' && ['system', 'display', 'yahei', 'mono'].includes(s.uiFont)) {
      settings.uiFont = s.uiFont as Settings['uiFont']
    }
    if (typeof s.monoFont === 'string' && ['cascadia', 'consolas', 'system'].includes(s.monoFont)) {
      settings.monoFont = s.monoFont as Settings['monoFont']
    }
    if (typeof s.fontScale === 'number' && s.fontScale >= 0.8 && s.fontScale <= 1.4) settings.fontScale = s.fontScale
    if (typeof s.zoom === 'number' && s.zoom >= 0.5 && s.zoom <= 2) settings.zoom = s.zoom
    if (typeof s.connectTimeoutMs === 'number' && s.connectTimeoutMs > 0) settings.connectTimeoutMs = s.connectTimeoutMs
    if (typeof s.callTimeoutMs === 'number' && s.callTimeoutMs > 0) settings.callTimeoutMs = s.callTimeoutMs
    if (s.shortcuts && typeof s.shortcuts === 'object') {
      const shortcuts: Partial<Record<ShortcutAction, string>> = {}
      for (const [action, value] of Object.entries(s.shortcuts as Record<string, unknown>)) {
        if (action in DEFAULT_SHORTCUTS && typeof value === 'string' && value.length < 60) {
          shortcuts[action as ShortcutAction] = value
        }
      }
      settings.shortcuts = shortcuts
    }
  }

  return { version: 1, servers, groups, settings }
}

export class Store {
  private file: string
  private state: AppState
  private lastDeleted: { server: MCPServerConfig; index: number } | null = null

  constructor(dir: string) {
    this.file = path.join(dir, 'mcp-helper.json')
    this.state = this.read()
  }

  get dataFile(): string {
    return this.file
  }

  private read(): AppState {
    for (const candidate of [this.file, `${this.file}.bak`]) {
      try {
        const text = fs.readFileSync(candidate, 'utf8')
        return normalize(JSON.parse(text))
      } catch {
        // try next candidate
      }
    }
    return defaultState()
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    if (fs.existsSync(this.file)) {
      try {
        fs.copyFileSync(this.file, `${this.file}.bak`)
      } catch {
        // ignore backup failure
      }
    }
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
    fs.renameSync(tmp, this.file)
  }

  getState(): AppState {
    return structuredClone(this.state)
  }

  findServer(id: string): MCPServerConfig | undefined {
    return this.state.servers.find((s) => s.id === id)
  }

  saveServer(draft: ServerDraft): AppState {
    const now = Date.now()
    if (draft.id) {
      const index = this.state.servers.findIndex((s) => s.id === draft.id)
      if (index >= 0) {
        const previous = this.state.servers[index]
        this.state.servers[index] = {
          ...previous,
          ...draft,
          id: previous.id,
          createdAt: previous.createdAt,
          updatedAt: now,
          lastTest: previous.lastTest
        }
        this.persist()
        return this.getState()
      }
    }
    const server: MCPServerConfig = {
      ...draft,
      id: draft.id || randomUUID(),
      createdAt: now,
      updatedAt: now
    }
    this.state.servers.push(server)
    this.persist()
    return this.getState()
  }

  deleteServer(id: string): AppState {
    const index = this.state.servers.findIndex((server) => server.id === id)
    if (index >= 0) {
      this.lastDeleted = { server: this.state.servers[index], index }
      this.state.servers = this.state.servers.filter((server) => server.id !== id)
      this.persist()
    }
    return this.getState()
  }

  undoDelete(): AppState {
    if (!this.lastDeleted) throw new Error('没有可恢复的删除记录')
    const { server, index } = this.lastDeleted
    this.lastDeleted = null
    const target = Math.min(index, this.state.servers.length)
    this.state.servers.splice(target, 0, server)
    this.persist()
    return this.getState()
  }

  patchServer(id: string, patch: Partial<MCPServerConfig>): AppState {
    const server = this.state.servers.find((s) => s.id === id)
    if (server) {
      Object.assign(server, patch, { updatedAt: Date.now() })
      this.persist()
    }
    return this.getState()
  }

  saveGroup(input: { id?: string; name: string; color?: string }): AppState {
    if (input.id) {
      const group = this.state.groups.find((g) => g.id === input.id)
      if (group) {
        group.name = input.name
        if (input.color) group.color = input.color
        this.persist()
        return this.getState()
      }
    }
    this.state.groups.push({
      id: input.id || randomUUID(),
      name: input.name,
      color: input.color || 'blue',
      order: this.state.groups.length
    })
    this.persist()
    return this.getState()
  }

  deleteGroup(id: string): AppState {
    this.state.groups = this.state.groups.filter((g) => g.id !== id)
    for (const server of this.state.servers) {
      if (server.groupId === id) server.groupId = null
    }
    this.persist()
    return this.getState()
  }

  reorderGroups(ids: string[]): AppState {
    ids.forEach((id, index) => {
      const group = this.state.groups.find((g) => g.id === id)
      if (group) group.order = index
    })
    this.state.groups.sort((a, b) => a.order - b.order)
    this.persist()
    return this.getState()
  }

  saveSettings(settings: Partial<Settings>): AppState {
    this.state.settings = { ...this.state.settings, ...settings }
    this.persist()
    return this.getState()
  }

  importServers(servers: ServerDraft[], groupName?: string): AppState {
    let groupId: string | null = null
    if (groupName) {
      const existing = this.state.groups.find((g) => g.name === groupName)
      if (existing) {
        groupId = existing.id
      } else {
        const group: MCPGroup = { id: randomUUID(), name: groupName, color: 'violet', order: this.state.groups.length }
        this.state.groups.push(group)
        groupId = group.id
      }
    }
    const now = Date.now()
    for (const draft of servers) {
      this.state.servers.push({
        ...draft,
        id: randomUUID(),
        groupId: draft.groupId ?? groupId,
        createdAt: now,
        updatedAt: now
      })
    }
    this.persist()
    return this.getState()
  }
}
