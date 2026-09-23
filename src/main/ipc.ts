import fs from 'node:fs'
import { ipcMain } from 'electron'
import type { ConnectionStatus, LogLine, MCPEvent, MCPServerConfig, ServerDraft, Settings, TestStage } from '../shared/types'
import type { Store } from './store'
import type { McpManager } from './mcp/manager'
import { CLIENT_FILES, exportFor, listClientTargets, parseClientFile, parseText, toDrafts, writeToClient } from './clients'
import type { ImportedServer } from '../shared/types'

export function registerIpc(store: Store, manager: McpManager, broadcast: (event: MCPEvent) => void): void {
  manager.on('status', (event: { serverId: string; status: ConnectionStatus; error?: string }) => {
    broadcast({ type: 'status', serverId: event.serverId, status: event.status, error: event.error })
  })

  manager.on('log', (event: { serverId: string; entry: LogLine }) => {
    broadcast({ type: 'log', serverId: event.serverId, entry: event.entry })
  })

  manager.on(
    'probe',
    (event: { serverId: string; stage: TestStage['key']; status: 'active' | 'done' | 'fail'; ms?: number; detail?: string }) => {
      broadcast({
        type: 'probe',
        serverId: event.serverId,
        stage: event.stage,
        status: event.status,
        ms: event.ms,
        detail: event.detail
      })
    }
  )

  const handle = (channel: string, handler: (...args: never[]) => unknown): void => {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        const data = await (handler as (...inner: unknown[]) => unknown)(...args)
        return { ok: true, data }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    })
  }

  const requireServer = (id: unknown): MCPServerConfig => {
    const found = typeof id === 'string' ? store.findServer(id) : undefined
    if (!found) throw new Error('该 MCP 已不存在')
    return found
  }

  handle('state:get', () => store.getState())

  handle('servers:save', async (draft: ServerDraft) => {
    if (!draft || !draft.name.trim()) throw new Error('名称不能为空')
    const state = store.saveServer(draft)
    if (draft.id) await manager.invalidate(draft.id)
    return state
  })

  handle('servers:delete', async (id: string) => {
    await manager.invalidate(id)
    return store.deleteServer(id)
  })

  handle('servers:undo-delete', () => store.undoDelete())

  handle('servers:patch', async (payload: { id: string; patch: Partial<MCPServerConfig> }) => {
    const state = store.patchServer(payload.id, payload.patch)
    if (payload.patch.enabled === false) await manager.invalidate(payload.id)
    return state
  })

  handle('groups:save', (input: { id?: string; name: string; color?: string }) => {
    if (!input || !input.name.trim()) throw new Error('分组名称不能为空')
    return store.saveGroup(input)
  })

  handle('groups:delete', (id: string) => store.deleteGroup(id))
  handle('groups:reorder', (ids: string[]) => store.reorderGroups(ids))
  handle('settings:save', (settings: Partial<Settings>) => store.saveSettings(settings))

  handle('servers:import', (payload: { servers: ImportedServer[]; groupName?: string }) => {
    if (!payload?.servers?.length) throw new Error('没有可导入的服务器')
    return store.importServers(toDrafts(payload.servers), payload.groupName)
  })

  handle('mcp:test', async (id: string) => {
    const cfg = requireServer(id)
    const result = await manager.test(cfg)
    store.patchServer(cfg.id, { lastTest: result })
    return result
  })

  handle('mcp:connect', async (id: string) => {
    await manager.connect(requireServer(id))
    return null
  })

  handle('mcp:disconnect', async (id: string) => {
    await manager.disconnect(id)
    return null
  })

  handle('mcp:snapshot', () => ({ statuses: manager.statuses(), logs: manager.allLogs() }))
  handle('mcp:capabilities', (id: string) => manager.capabilities(requireServer(id)))

  handle('mcp:callTool', (payload: { id: string; name: string; args: Record<string, unknown> }) =>
    manager.callTool(requireServer(payload.id), payload.name, payload.args ?? {})
  )

  handle('mcp:readResource', (payload: { id: string; uri: string }) =>
    manager.readResource(requireServer(payload.id), payload.uri)
  )

  handle('mcp:getPrompt', (payload: { id: string; name: string; args: Record<string, string> }) =>
    manager.getPrompt(requireServer(payload.id), payload.name, payload.args ?? {})
  )

  handle('mcp:logs', (id: string) => manager.logsOf(id))

  handle('clients:targets', () => listClientTargets())

  handle('app:data-file', () => store.dataFile)

  handle('clients:parse', (payload: { clientId?: string; json?: string }) => {
    if (payload?.json && payload.json.trim()) return parseText(payload.json)
    const file = CLIENT_FILES.find((item) => item.id === payload?.clientId)
    if (!file) throw new Error('未知的客户端')
    if (!fs.existsSync(file.path)) throw new Error(`未找到 ${file.name} 的配置文件`)
    return parseClientFile(file)
  })

  handle('clients:export', (payload: { clientId: string; ids: string[]; write: boolean }) => {
    const servers = payload.ids.length ? payload.ids.map((id) => requireServer(id)) : store.getState().servers
    if (!servers.length) throw new Error('没有可导出的服务器')
    if (payload.write) {
      const written = writeToClient(payload.clientId, servers)
      return { json: exportFor(payload.clientId, servers), path: written.path, backup: written.backup }
    }
    return { json: exportFor(payload.clientId, servers) }
  })
}
