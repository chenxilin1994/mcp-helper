import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ClientTarget, ImportedServer, MCPServerConfig, ParseResult, ServerDraft, TransportType } from '../shared/types'

const APPDATA = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
const HOME = os.homedir()

export interface ClientFile {
  id: string
  name: string
  path: string
  kind: 'mcpServers' | 'vscode' | 'opencode'
  writable: boolean
}

export const CLIENT_FILES: ClientFile[] = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    path: path.join(APPDATA, 'Claude', 'claude_desktop_config.json'),
    kind: 'mcpServers',
    writable: true
  },
  {
    id: 'cursor',
    name: 'Cursor',
    path: path.join(HOME, '.cursor', 'mcp.json'),
    kind: 'mcpServers',
    writable: true
  },
  {
    id: 'vscode',
    name: 'VS Code',
    path: path.join(APPDATA, 'Code', 'User', 'mcp.json'),
    kind: 'vscode',
    writable: true
  },
  {
    id: 'opencode',
    name: 'opencode',
    path: path.join(HOME, '.config', 'opencode', 'opencode.json'),
    kind: 'opencode',
    writable: true
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    path: path.join(HOME, '.claude.json'),
    kind: 'mcpServers',
    writable: false
  }
]

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function asTransport(value: unknown): TransportType | null {
  return value === 'stdio' || value === 'sse' || value === 'http' || value === 'streamable-http'
    ? value === 'streamable-http'
      ? 'http'
      : value
    : null
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined || val === null) continue
    out[key] = typeof val === 'string' ? val : String(val)
  }
  return Object.keys(out).length ? out : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.map((item) => String(item))
}

function remoteTransport(type: TransportType | null): TransportType {
  return type === 'sse' ? 'sse' : 'http'
}

function parseMcpServersEntry(raw: unknown): ImportedServer | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  const type = asTransport(entry.type)
  const url = typeof entry.url === 'string' ? entry.url : undefined
  const command = typeof entry.command === 'string' ? entry.command : undefined

  if (command) {
    return {
      name: '',
      transport: 'stdio',
      command,
      args: asStringArray(entry.args),
      env: asStringRecord(entry.env),
      cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined
    }
  }
  if (url) {
    return {
      name: '',
      transport: remoteTransport(type ?? 'http'),
      url,
      headers: asStringRecord(entry.headers)
    }
  }
  if (Array.isArray(entry.command) && entry.command.length) {
    const [cmd, ...args] = entry.command.map((item) => String(item))
    return { name: '', transport: 'stdio', command: cmd, args, env: asStringRecord(entry.env) }
  }
  return null
}

function parseMcpServers(document: unknown): ImportedServer[] {
  const out: ImportedServer[] = []
  if (!document || typeof document !== 'object') return out
  const root = document as Record<string, unknown>
  const container = (root.mcpServers ?? root.servers) as Record<string, unknown> | undefined
  if (!container || typeof container !== 'object') return out
  for (const [name, value] of Object.entries(container)) {
    const parsed = parseMcpServersEntry(value)
    if (parsed) out.push({ ...parsed, name })
  }
  return out
}

function parseVsCode(document: unknown): ImportedServer[] {
  const out: ImportedServer[] = []
  if (!document || typeof document !== 'object') return out
  const servers = (document as Record<string, unknown>).servers as Record<string, unknown> | undefined
  if (!servers || typeof servers !== 'object') return out
  for (const [name, value] of Object.entries(servers)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const type = asTransport(entry.type)
    const command = typeof entry.command === 'string' ? entry.command : undefined
    const url = typeof entry.url === 'string' ? entry.url : undefined
    if (command) {
      out.push({
        name,
        transport: type ?? 'stdio',
        command,
        args: asStringArray(entry.args),
        env: asStringRecord(entry.env),
        cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined
      })
    } else if (url) {
      out.push({ name, transport: remoteTransport(type ?? 'http'), url, headers: asStringRecord(entry.headers) })
    }
  }
  return out
}

function parseOpencode(document: unknown): ImportedServer[] {
  const out: ImportedServer[] = []
  if (!document || typeof document !== 'object') return out
  const mcp = (document as Record<string, unknown>).mcp as Record<string, unknown> | undefined
  if (!mcp || typeof mcp !== 'object') return out
  for (const [name, value] of Object.entries(mcp)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    if (entry.type === 'remote') {
      if (typeof entry.url !== 'string') continue
      out.push({
        name,
        transport: 'http',
        url: entry.url,
        headers: asStringRecord(entry.headers)
      })
    } else {
      const command = Array.isArray(entry.command) ? entry.command.map((item) => String(item)) : []
      if (!command.length) continue
      const [cmd, ...args] = command
      out.push({
        name,
        transport: 'stdio',
        command: cmd,
        args,
        env: asStringRecord(entry.environment)
      })
    }
  }
  return out
}

function parseOwnFormat(document: unknown): ImportedServer[] {
  const out: ImportedServer[] = []
  if (!document || typeof document !== 'object') return out
  const servers = (document as Record<string, unknown>).servers
  if (!Array.isArray(servers)) return out
  for (const item of servers) {
    if (!item || typeof item !== 'object') continue
    const server = item as Record<string, unknown>
    const transport = asTransport(server.transport)
    const command = typeof server.command === 'string' ? server.command : undefined
    const url = typeof server.url === 'string' ? server.url : undefined
    if (transport && command) {
      out.push({
        name: typeof server.name === 'string' ? server.name : command,
        transport,
        command,
        args: asStringArray(server.args),
        env: asStringRecord(server.env),
        cwd: typeof server.cwd === 'string' ? server.cwd : undefined,
        url,
        headers: asStringRecord(server.headers)
      })
    } else if (command) {
      out.push({
        name: typeof server.name === 'string' ? server.name : command,
        transport: 'stdio',
        command,
        args: asStringArray(server.args),
        env: asStringRecord(server.env)
      })
    } else if (url) {
      out.push({
        name: typeof server.name === 'string' ? server.name : url,
        transport: remoteTransport(transport),
        url,
        headers: asStringRecord(server.headers)
      })
    }
  }
  return out
}

export function parseDocument(document: unknown): ParseResult {
  const warnings: string[] = []
  const own = parseOwnFormat(document)
  if (own.length) return { source: 'MCP Helper 导出', servers: own, warnings }

  const generic = parseMcpServers(document)
  if (generic.length) {
    return { source: 'mcpServers 配置', servers: generic, warnings }
  }

  const vscode = parseVsCode(document)
  if (vscode.length) return { source: 'VS Code 配置', servers: vscode, warnings }

  const opencode = parseOpencode(document)
  if (opencode.length) return { source: 'opencode 配置', servers: opencode, warnings }

  return { source: '', servers: [], warnings: ['未在 JSON 中找到可导入的 MCP 服务器定义'] }
}

export function parseClientFile(file: ClientFile): ParseResult {
  const document = readJson(file.path)
  const parsed = parseDocument(document)
  return parsed.servers.length ? parsed : { ...parsed, source: file.name }
}

export function parseText(text: string): ParseResult {
  try {
    return parseDocument(JSON.parse(text))
  } catch (error) {
    return {
      source: '',
      servers: [],
      warnings: [`JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}

export function listClientTargets(): ClientTarget[] {
  return CLIENT_FILES.map((file) => {
    const available = fs.existsSync(file.path)
    let serverCount = 0
    let error: string | undefined
    if (available) {
      try {
        serverCount = parseClientFile(file).servers.length
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
    }
    return { id: file.id, name: file.name, configPath: file.path, available, serverCount, error }
  })
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  let index = 2
  while (used.has(`${name} (${index})`)) index += 1
  const result = `${name} (${index})`
  used.add(result)
  return result
}

export function exportFor(clientId: string, servers: MCPServerConfig[]): string {
  const file = CLIENT_FILES.find((item) => item.id === clientId)
  const used = new Set<string>()

  if (file?.kind === 'opencode') {
    const mcp: Record<string, unknown> = {}
    for (const server of servers) {
      const name = uniqueName(server.name, used)
      if (server.transport === 'stdio') {
        mcp[name] = {
          type: 'local',
          command: [server.command, ...server.args].filter((part) => part.trim().length > 0),
          ...(Object.keys(server.env).length ? { environment: server.env } : {}),
          enabled: server.enabled
        }
      } else {
        mcp[name] = {
          type: 'remote',
          url: server.url,
          ...(Object.keys(server.headers).length ? { headers: server.headers } : {}),
          enabled: server.enabled
        }
      }
    }
    return JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp }, null, 2)
  }

  if (file?.kind === 'vscode') {
    const out: Record<string, unknown> = {}
    for (const server of servers) {
      const name = uniqueName(server.name, used)
      if (server.transport === 'stdio') {
        out[name] = {
          type: 'stdio',
          command: server.command,
          args: server.args.filter((arg) => arg.trim().length > 0),
          ...(Object.keys(server.env).length ? { env: server.env } : {}),
          ...(server.cwd ? { cwd: server.cwd } : {})
        }
      } else {
        out[name] = {
          type: server.transport,
          url: server.url,
          ...(Object.keys(server.headers).length ? { headers: server.headers } : {})
        }
      }
    }
    return JSON.stringify({ servers: out }, null, 2)
  }

  const out: Record<string, unknown> = {}
  for (const server of servers) {
    const name = uniqueName(server.name, used)
    if (server.transport === 'stdio') {
      out[name] = {
        command: server.command,
        args: server.args.filter((arg) => arg.trim().length > 0),
        ...(Object.keys(server.env).length ? { env: server.env } : {}),
        ...(server.cwd ? { cwd: server.cwd } : {})
      }
    } else {
      out[name] = {
        type: server.transport,
        url: server.url,
        ...(Object.keys(server.headers).length ? { headers: server.headers } : {})
      }
    }
  }
  return JSON.stringify({ mcpServers: out }, null, 2)
}

export function writeToClient(clientId: string, servers: MCPServerConfig[]): { path: string; backup?: string } {
  const file = CLIENT_FILES.find((item) => item.id === clientId)
  if (!file) throw new Error(`未知的客户端: ${clientId}`)
  if (!file.writable) throw new Error(`${file.name} 的配置暂不支持自动写入`)

  const exported = JSON.parse(exportFor(clientId, servers)) as Record<string, unknown>
  const containerKey = file.kind === 'opencode' ? 'mcp' : file.kind === 'vscode' ? 'servers' : 'mcpServers'

  let document: Record<string, unknown> = {}
  if (fs.existsSync(file.path)) {
    try {
      document = JSON.parse(fs.readFileSync(file.path, 'utf8')) as Record<string, unknown>
    } catch {
      throw new Error(`${file.name} 配置文件不是合法 JSON，已中止写入`)
    }
  }

  let backup: string | undefined
  if (fs.existsSync(file.path)) {
    backup = `${file.path}.mcp-helper.bak`
    fs.copyFileSync(file.path, backup)
  } else {
    fs.mkdirSync(path.dirname(file.path), { recursive: true })
  }

  const existing = (document[containerKey] ?? {}) as Record<string, unknown>
  document[containerKey] = { ...existing, ...(exported[containerKey] as Record<string, unknown>) }

  fs.writeFileSync(file.path, JSON.stringify(document, null, 2), 'utf8')
  return { path: file.path, backup }
}

export function toDrafts(servers: ImportedServer[]): ServerDraft[] {
  return servers.map((server) => ({
    name: server.name,
    description: '',
    groupId: null,
    enabled: true,
    favorite: false,
    transport: server.transport,
    command: server.command ?? '',
    args: server.args ?? [],
    env: server.env ?? {},
    cwd: server.cwd ?? '',
    url: server.url ?? '',
    headers: server.headers ?? {}
  }))
}
