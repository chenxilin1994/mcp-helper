import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  Capabilities,
  ConnectionStatus,
  ContentBlock,
  LogLine,
  MCPServerConfig,
  PromptResult,
  ResourceReadResult,
  ServerInfo,
  Settings,
  TestResult,
  TestStage,
  ToolCallResult
} from '../../shared/types'

type AnyTransport = StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport

interface ProbeTimings {
  startedAt: number
  handshakeMs?: number
  pingMs?: number
  failedStage?: TestStage['key']
}

interface Connection {
  serverId: string
  client: Client
  transport: AnyTransport
  status: ConnectionStatus
  connecting?: Promise<void>
  closing: boolean
  logs: LogLine[]
  protocolVersion?: string
  lastError?: string
  probe?: ProbeTimings
}

const MAX_LOGS = 500
const TOOL_NAME = 'mcp-helper'
const TOOL_VERSION = '0.1.0'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function toPlain<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function killProcessTree(pid: number): void {
  if (process.platform !== 'win32') return
  try {
    process.kill(pid, 0)
  } catch {
    return
  }
  try {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
  } catch {
    // ignore
  }
}

export class McpManager extends EventEmitter {
  private connections = new Map<string, Connection>()

  constructor(private getSettings: () => Settings) {
    super()
  }

  statusOf(serverId: string): ConnectionStatus {
    return this.connections.get(serverId)?.status ?? 'disconnected'
  }

  statuses(): Record<string, ConnectionStatus> {
    const out: Record<string, ConnectionStatus> = {}
    for (const [id, conn] of this.connections) out[id] = conn.status
    return out
  }

  allLogs(): Record<string, LogLine[]> {
    const out: Record<string, LogLine[]> = {}
    for (const [id, conn] of this.connections) out[id] = conn.logs
    return out
  }

  logsOf(serverId: string): LogLine[] {
    return this.connections.get(serverId)?.logs ?? []
  }

  private log(serverId: string, level: LogLine['level'], line: string): void {
    const entry: LogLine = { at: Date.now(), level, line }
    const conn = this.connections.get(serverId)
    if (conn) {
      conn.logs.push(entry)
      if (conn.logs.length > MAX_LOGS) conn.logs.splice(0, conn.logs.length - MAX_LOGS)
    }
    this.emit('log', { serverId, entry })
  }

  private setStatus(serverId: string, status: ConnectionStatus, error?: string): void {
    const conn = this.connections.get(serverId)
    if (conn) conn.status = status
    this.emit('status', { serverId, status, error })
  }

  private probe(
    serverId: string,
    stage: TestStage['key'],
    status: 'active' | 'done' | 'fail',
    ms?: number,
    detail?: string
  ): void {
    this.emit('probe', { serverId, stage, status, ms, detail })
  }

  private linkLabel(transport: MCPServerConfig['transport']): string {
    return transport === 'stdio' ? '进程启动' : '建立连接'
  }

  private linkDone(serverId: string, conn: Connection | undefined, totalMs: number): void {
    const handshakeMs = conn?.probe?.handshakeMs ?? 0
    const pingMs = conn?.probe?.pingMs ?? 0
    this.probe(serverId, 'link', 'done', Math.max(0, totalMs - handshakeMs - pingMs))
  }

  private serverInfo(conn: Connection): ServerInfo {
    const version = conn.client.getServerVersion()
    return {
      name: version?.name ?? 'unknown',
      version: version?.version ?? '',
      title: version?.title,
      protocolVersion: conn.protocolVersion,
      capabilities: conn.client.getServerCapabilities() as Record<string, unknown> | undefined,
      instructions: conn.client.getInstructions()
    }
  }

  private watchHandshake(conn: Connection): void {
    const client = conn.client as unknown as { request: (...args: unknown[]) => Promise<unknown> }
    const original = client.request.bind(client)
    client.request = async (...args: unknown[]) => {
      const request = args[0] as { method?: string } | undefined
      const requestStart = Date.now()
      try {
        const result = (await original(...args)) as { protocolVersion?: string } | undefined
        if (request?.method === 'initialize') {
          if (result?.protocolVersion) conn.protocolVersion = result.protocolVersion
          const ms = Date.now() - requestStart
          if (conn.probe) conn.probe.handshakeMs = ms
          this.probe(conn.serverId, 'handshake', 'done', ms)
        }
        return result
      } catch (error) {
        if (request?.method === 'initialize') {
          const ms = Date.now() - requestStart
          if (conn.probe) conn.probe.failedStage = 'handshake'
          this.probe(conn.serverId, 'handshake', 'fail', ms, errorMessage(error))
        }
        throw error
      }
    }
  }

  private buildTransport(cfg: MCPServerConfig): AnyTransport {
    if (cfg.transport === 'stdio') {
      const transport = new StdioClientTransport({
        command: cfg.command,
        args: cfg.args.filter((arg) => arg.trim().length > 0),
        cwd: cfg.cwd.trim() ? cfg.cwd : undefined,
        env: { ...getDefaultEnvironment(), ...cfg.env },
        stderr: 'pipe'
      })
      const stream = transport.stderr
      if (stream) {
        let buffer = ''
        stream.on('data', (chunk: Buffer | string) => {
          buffer += chunk.toString()
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.trim()) this.log(cfg.id, 'stderr', line)
          }
        })
      }
      return transport
    }

    let url: URL
    try {
      url = new URL(cfg.url)
    } catch {
      throw new Error(`无效的地址: ${cfg.url}`)
    }

    const headers = { ...cfg.headers }
    if (cfg.transport === 'sse') {
      return new SSEClientTransport(url, {
        requestInit: { headers },
        eventSourceInit: {
          fetch: (input: string | URL, init?: Record<string, unknown>) => fetch(input, { ...init, headers })
        }
      } as never)
    }
    return new StreamableHTTPClientTransport(url, { requestInit: { headers } } as never)
  }

  private async open(cfg: MCPServerConfig, options?: { fresh?: boolean }): Promise<Connection> {
    const existing = this.connections.get(cfg.id)

    if (existing && options?.fresh !== true) {
      if (existing.status === 'ready') return existing
      if (existing.connecting) {
        await existing.connecting
        const after = this.connections.get(cfg.id)
        if (after?.status === 'ready') return after
        throw new Error(`无法连接到 ${cfg.name}`)
      }
    }

    if (existing) await this.disconnect(cfg.id)

    const conn: Connection = {
      serverId: cfg.id,
      client: undefined as unknown as Client,
      transport: undefined as unknown as AnyTransport,
      status: 'connecting',
      closing: false,
      logs: existing?.logs ?? [],
      probe: { startedAt: Date.now() }
    }
    this.connections.set(cfg.id, conn)
    this.setStatus(cfg.id, 'connecting')
    this.probe(cfg.id, 'link', 'active')
    this.log(cfg.id, 'info', `启动 ${cfg.transport === 'stdio' ? cfg.command : cfg.url}`)

    const client = new Client({ name: TOOL_NAME, title: 'MCP Helper', version: TOOL_VERSION }, { capabilities: {} })
    const transport = this.buildTransport(cfg)
    conn.client = client
    conn.transport = transport
    this.watchHandshake(conn)

    client.onerror = (error) => {
      if (conn.closing) return
      conn.lastError = errorMessage(error)
      this.log(cfg.id, 'error', conn.lastError)
    }

    const connecting = (async () => {
      try {
        await client.connect(transport, { timeout: this.getSettings().connectTimeoutMs })
        conn.status = 'ready'
        const info = this.serverInfo(conn)
        const detail = [
          info.name + (info.version ? ` v${info.version}` : ''),
          info.protocolVersion ? `协议 ${info.protocolVersion}` : ''
        ]
          .filter(Boolean)
          .join(' · ')
        this.log(cfg.id, 'protocol', `初始化完成 · ${detail}`)
        this.setStatus(cfg.id, 'ready')
      } catch (error) {
        conn.status = 'error'
        throw error
      } finally {
        conn.connecting = undefined
      }
    })()
    conn.connecting = connecting
    await connecting
    return conn
  }

  async connect(cfg: MCPServerConfig): Promise<void> {
    const started = Date.now()
    const conn = await this.open(cfg)
    this.linkDone(cfg.id, conn, Date.now() - started)
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return
    conn.closing = true
    this.connections.delete(serverId)
    const pid = (conn.transport as unknown as { pid?: number }).pid
    try {
      await conn.client.close()
    } catch {
      // ignore
    }
    if (typeof pid === 'number') killProcessTree(pid)
    this.log(serverId, 'info', '连接已断开')
    this.setStatus(serverId, 'disconnected')
  }

  async invalidate(serverId: string): Promise<void> {
    if (this.connections.has(serverId)) await this.disconnect(serverId)
  }

  async disposeAll(): Promise<void> {
    await Promise.all([...this.connections.keys()].map((id) => this.disconnect(id)))
  }

  async test(cfg: MCPServerConfig): Promise<TestResult> {
    const started = Date.now()
    try {
      const conn = await this.open(cfg, { fresh: true })

      const pingStart = Date.now()
      try {
        await conn.client.ping({ timeout: this.getSettings().connectTimeoutMs })
        const pingMs = Date.now() - pingStart
        if (conn.probe) conn.probe.pingMs = pingMs
        this.probe(cfg.id, 'ping', 'done', pingMs)
      } catch (error) {
        const pingMs = Date.now() - pingStart
        if (conn.probe) conn.probe.failedStage = 'ping'
        this.probe(cfg.id, 'ping', 'fail', pingMs, errorMessage(error))
        throw error
      }

      const latencyMs = Date.now() - started
      const serverInfo = this.serverInfo(conn)
      const handshakeMs = conn.probe?.handshakeMs ?? 0
      const pingMs = conn.probe?.pingMs ?? 0
      const linkMs = Math.max(0, latencyMs - handshakeMs - pingMs)
      this.linkDone(cfg.id, conn, latencyMs)

      const stages: TestStage[] = [
        { key: 'link', label: this.linkLabel(cfg.transport), ms: linkMs },
        { key: 'handshake', label: '初始化握手', ms: handshakeMs },
        { key: 'ping', label: '心跳检测', ms: pingMs }
      ]

      this.log(cfg.id, 'info', `连通性正常 · 总耗时 ${latencyMs}ms`)
      return { status: 'ok', latencyMs, at: Date.now(), serverInfo, stages }
    } catch (error) {
      const conn = this.connections.get(cfg.id)
      const message = conn?.lastError ?? errorMessage(error)
      if (conn && !conn.probe?.failedStage) {
        this.probe(cfg.id, 'link', 'fail', Date.now() - started, message)
      }
      if (this.connections.has(cfg.id)) await this.disconnect(cfg.id)
      this.log(cfg.id, 'error', `测试失败: ${message}`)
      this.setStatus(cfg.id, 'error', message)
      return { status: 'error', latencyMs: Date.now() - started, at: Date.now(), error: message }
    }
  }

  private async listAll<T>(
    serverId: string,
    label: string,
    fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
  ): Promise<T[]> {
    const items: T[] = []
    let cursor: string | undefined
    const started = Date.now()
    for (let page = 0; page < 50; page += 1) {
      const result = await fetchPage(cursor)
      items.push(...result.items)
      cursor = result.nextCursor
      if (!cursor) break
    }
    this.log(serverId, 'protocol', `← ${label} · ${items.length} 项 · ${Date.now() - started}ms`)
    return items
  }

  async capabilities(cfg: MCPServerConfig): Promise<Capabilities> {
    const conn = await this.open(cfg)
    const started = Date.now()
    const timeout = this.getSettings().callTimeoutMs
    const declared = (conn.client.getServerCapabilities() ?? {}) as Record<string, unknown>
    this.log(cfg.id, 'protocol', '→ tools/list · resources/list · prompts/list')

    const caps: Capabilities = { tools: [], resources: [], resourceTemplates: [], prompts: [], durationMs: 0 }

    const tasks: Promise<void>[] = []

    if (declared.tools) {
      tasks.push(
        this.listAll(cfg.id, 'tools/list', async (cursor) => {
          const page = await conn.client.listTools(cursor ? { cursor } : {}, { timeout })
          return {
            items: (page.tools ?? []).map((tool) => ({
              name: tool.name,
              title: tool.title,
              description: tool.description,
              inputSchema: toPlain(tool.inputSchema),
              outputSchema: toPlain((tool as { outputSchema?: unknown }).outputSchema),
              annotations: toPlain((tool as { annotations?: unknown }).annotations)
            })),
            nextCursor: page.nextCursor
          }
        }).then((items) => void (caps.tools = items))
      )
    }

    if (declared.resources) {
      tasks.push(
        this.listAll(cfg.id, 'resources/list', async (cursor) => {
          const page = await conn.client.listResources(cursor ? { cursor } : {}, { timeout })
          return {
            items: (page.resources ?? []).map((resource) => ({
              uri: resource.uri,
              name: resource.name,
              title: resource.title,
              description: resource.description,
              mimeType: resource.mimeType
            })),
            nextCursor: page.nextCursor
          }
        }).then((items) => void (caps.resources = items))
      )
      tasks.push(
        this.listAll(cfg.id, 'resources/templates', async (cursor) => {
          const page = await conn.client.listResourceTemplates(cursor ? { cursor } : {}, { timeout })
          return {
            items: (page.resourceTemplates ?? []).map((template) => ({
              uriTemplate: template.uriTemplate,
              name: template.name,
              title: template.title,
              description: template.description,
              mimeType: template.mimeType
            })),
            nextCursor: page.nextCursor
          }
        }).then((items) => void (caps.resourceTemplates = items))
      )
    }

    if (declared.prompts) {
      tasks.push(
        this.listAll(cfg.id, 'prompts/list', async (cursor) => {
          const page = await conn.client.listPrompts(cursor ? { cursor } : {}, { timeout })
          return {
            items: (page.prompts ?? []).map((prompt) => ({
              name: prompt.name,
              title: prompt.title,
              description: prompt.description,
              arguments: prompt.arguments
            })),
            nextCursor: page.nextCursor
          }
        }).then((items) => void (caps.prompts = items))
      )
    }

    const results = await Promise.allSettled(tasks)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.log(cfg.id, 'warn', `能力枚举部分失败: ${errorMessage(result.reason)}`)
      }
    }

    caps.durationMs = Date.now() - started
    return caps
  }

  async callTool(cfg: MCPServerConfig, name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const conn = await this.open(cfg)
    const started = Date.now()
    this.log(cfg.id, 'protocol', `→ tools/call ${name}`)
    try {
      const result = await conn.client.callTool({ name, arguments: args }, undefined, {
        timeout: this.getSettings().callTimeoutMs
      })
      const latencyMs = Date.now() - started
      this.log(cfg.id, 'protocol', `← tools/call ${name} · ${latencyMs}ms`)
      return {
        content: toPlain((result.content ?? []) as ContentBlock[]),
        isError: result.isError === true,
        structuredContent: toPlain((result as { structuredContent?: unknown }).structuredContent),
        latencyMs,
        raw: toPlain(result)
      }
    } catch (error) {
      this.log(cfg.id, 'error', `tools/call ${name} 失败: ${errorMessage(error)}`)
      throw error
    }
  }

  async readResource(cfg: MCPServerConfig, uri: string): Promise<ResourceReadResult> {
    const conn = await this.open(cfg)
    const started = Date.now()
    this.log(cfg.id, 'protocol', `→ resources/read ${uri}`)
    try {
      const result = await conn.client.readResource({ uri }, { timeout: this.getSettings().callTimeoutMs })
      const latencyMs = Date.now() - started
      this.log(cfg.id, 'protocol', `← resources/read · ${latencyMs}ms`)
      return { contents: toPlain(result.contents ?? []), latencyMs, raw: toPlain(result) }
    } catch (error) {
      this.log(cfg.id, 'error', `resources/read 失败: ${errorMessage(error)}`)
      throw error
    }
  }

  async getPrompt(cfg: MCPServerConfig, name: string, args: Record<string, string>): Promise<PromptResult> {
    const conn = await this.open(cfg)
    const started = Date.now()
    this.log(cfg.id, 'protocol', `→ prompts/get ${name}`)
    try {
      const result = await conn.client.getPrompt({ name, arguments: args }, { timeout: this.getSettings().callTimeoutMs })
      const latencyMs = Date.now() - started
      this.log(cfg.id, 'protocol', `← prompts/get · ${latencyMs}ms`)
      return {
        description: result.description,
        messages: toPlain(
          (result.messages ?? []).map((message) => ({ role: message.role, content: message.content as ContentBlock }))
        ),
        latencyMs,
        raw: toPlain(result)
      }
    } catch (error) {
      this.log(cfg.id, 'error', `prompts/get ${name} 失败: ${errorMessage(error)}`)
      throw error
    }
  }
}
