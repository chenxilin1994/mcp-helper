export type TransportType = 'stdio' | 'sse' | 'http'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error'

export type ThemeMode = 'system' | 'dark' | 'light'

export interface TestStage {
  key: 'link' | 'handshake' | 'ping'
  label: string
  ms: number
}

export interface TestResult {
  status: 'ok' | 'error'
  latencyMs: number
  at: number
  serverInfo?: ServerInfo
  error?: string
  stages?: TestStage[]
}

export interface ServerInfo {
  name: string
  version: string
  title?: string
  protocolVersion?: string
  capabilities?: Record<string, unknown>
  instructions?: string
}

export interface MCPServerConfig {
  id: string
  name: string
  description: string
  groupId: string | null
  enabled: boolean
  favorite: boolean
  transport: TransportType
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
  url: string
  headers: Record<string, string>
  createdAt: number
  updatedAt: number
  lastTest?: TestResult
}

export type ServerDraft = Omit<MCPServerConfig, 'id' | 'createdAt' | 'updatedAt' | 'lastTest'> & {
  id?: string
}

export interface MCPGroup {
  id: string
  name: string
  color: string
  order: number
}

export interface Settings {
  theme: ThemeMode
  connectTimeoutMs: number
  callTimeoutMs: number
}

export interface AppState {
  version: number
  servers: MCPServerConfig[]
  groups: MCPGroup[]
  settings: Settings
}

export interface ToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  outputSchema?: unknown
  annotations?: unknown
}

export interface ResourceInfo {
  uri: string
  name: string
  title?: string
  description?: string
  mimeType?: string
}

export interface ResourceTemplateInfo {
  uriTemplate: string
  name: string
  title?: string
  description?: string
  mimeType?: string
}

export interface PromptArgumentInfo {
  name: string
  description?: string
  required?: boolean
}

export interface PromptInfo {
  name: string
  title?: string
  description?: string
  arguments?: PromptArgumentInfo[]
}

export interface Capabilities {
  tools: ToolInfo[]
  resources: ResourceInfo[]
  resourceTemplates: ResourceTemplateInfo[]
  prompts: PromptInfo[]
  durationMs: number
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string; blob?: string } }
  | { type: string; [key: string]: unknown }

export interface ToolCallResult {
  content: ContentBlock[]
  isError: boolean
  structuredContent?: unknown
  latencyMs: number
  raw: unknown
}

export interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>
  latencyMs: number
  raw: unknown
}

export interface PromptResult {
  description?: string
  messages: Array<{ role: string; content: ContentBlock }>
  latencyMs: number
  raw: unknown
}

export interface LogLine {
  at: number
  level: 'info' | 'warn' | 'error' | 'protocol' | 'stderr'
  line: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type MCPEvent =
  | { type: 'status'; serverId: string; status: ConnectionStatus; error?: string }
  | { type: 'log'; serverId: string; entry: LogLine }
  | {
      type: 'probe'
      serverId: string
      stage: TestStage['key']
      status: 'active' | 'done' | 'fail'
      ms?: number
      detail?: string
    }

export interface ClientTarget {
  id: string
  name: string
  configPath: string
  available: boolean
  serverCount: number
  error?: string
}

export interface ImportedServer {
  name: string
  transport: TransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
}

export interface ParseResult {
  source: string
  servers: ImportedServer[]
  warnings: string[]
}
