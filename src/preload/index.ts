import { contextBridge, ipcRenderer } from 'electron'
import type { McpHelperApi } from '../shared/api'
import type { MCPEvent, Result } from '../shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.data
}

const api: McpHelperApi = {
  getState: () => invoke('state:get'),
  saveServer: (draft) => invoke('servers:save', draft),
  deleteServer: (id) => invoke('servers:delete', id),
  undoDelete: () => invoke('servers:undo-delete'),
  patchServer: (payload) => invoke('servers:patch', payload),
  saveGroup: (input) => invoke('groups:save', input),
  deleteGroup: (id) => invoke('groups:delete', id),
  reorderGroups: (ids) => invoke('groups:reorder', ids),
  saveSettings: (settings) => invoke('settings:save', settings),
  importServers: (payload) => invoke('servers:import', payload),

  test: (id) => invoke('mcp:test', id),
  connect: (id) => invoke('mcp:connect', id),
  disconnect: (id) => invoke('mcp:disconnect', id),
  snapshot: () => invoke('mcp:snapshot'),
  capabilities: (id) => invoke('mcp:capabilities', id),
  callTool: (payload) => invoke('mcp:callTool', payload),
  readResource: (payload) => invoke('mcp:readResource', payload),
  getPrompt: (payload) => invoke('mcp:getPrompt', payload),
  logs: (id) => invoke('mcp:logs', id),

  clientTargets: () => invoke('clients:targets'),
  parseImport: (payload) => invoke('clients:parse', payload),
  exportClient: (payload) => invoke('clients:export', payload),
  dataFile: () => invoke('app:data-file'),

  onEvent: (listener) => {
    const handler = (_event: unknown, payload: MCPEvent): void => listener(payload)
    ipcRenderer.on('mcp:event', handler)
    return () => {
      ipcRenderer.removeListener('mcp:event', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
