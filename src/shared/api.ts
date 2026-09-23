import type {
  AppState,
  Capabilities,
  ClientTarget,
  ConnectionStatus,
  ImportedServer,
  LogLine,
  MCPEvent,
  MCPServerConfig,
  ParseResult,
  PromptResult,
  ResourceReadResult,
  ServerDraft,
  Settings,
  TestResult,
  ToolCallResult
} from './types'

export interface ExportResult {
  json: string
  path?: string
  backup?: string
}

export interface RuntimeSnapshot {
  statuses: Record<string, ConnectionStatus>
  logs: Record<string, LogLine[]>
}

export interface McpHelperApi {
  getState(): Promise<AppState>
  saveServer(draft: ServerDraft): Promise<AppState>
  deleteServer(id: string): Promise<AppState>
  undoDelete(): Promise<AppState>
  patchServer(payload: { id: string; patch: Partial<MCPServerConfig> }): Promise<AppState>
  saveGroup(input: { id?: string; name: string; color?: string }): Promise<AppState>
  deleteGroup(id: string): Promise<AppState>
  reorderGroups(ids: string[]): Promise<AppState>
  saveSettings(settings: Partial<Settings>): Promise<AppState>

  importServers(payload: { servers: ImportedServer[]; groupName?: string }): Promise<AppState>

  test(id: string): Promise<TestResult>
  connect(id: string): Promise<null>
  disconnect(id: string): Promise<null>
  snapshot(): Promise<RuntimeSnapshot>
  capabilities(id: string): Promise<Capabilities>
  callTool(payload: { id: string; name: string; args: Record<string, unknown> }): Promise<ToolCallResult>
  readResource(payload: { id: string; uri: string }): Promise<ResourceReadResult>
  getPrompt(payload: { id: string; name: string; args: Record<string, string> }): Promise<PromptResult>
  logs(id: string): Promise<LogLine[]>

  clientTargets(): Promise<ClientTarget[]>
  parseImport(payload: { clientId?: string; json?: string }): Promise<ParseResult>
  exportClient(payload: { clientId: string; ids: string[]; write: boolean }): Promise<ExportResult>
  dataFile(): Promise<string>

  onEvent(listener: (event: MCPEvent) => void): () => void
}
