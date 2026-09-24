import type { MCPServerConfig } from '@shared/types'
import { commandPreview } from '../lib/format'
import type { UIState } from './store'

export function selectVisibleServers(state: UIState): MCPServerConfig[] {
  const all = state.app?.servers ?? []
  const query = state.search.trim().toLowerCase()

  let filtered = all
  if (state.groupFilter === 'none') filtered = filtered.filter((server) => !server.groupId)
  else if (state.groupFilter !== 'all') filtered = filtered.filter((server) => server.groupId === state.groupFilter)

  if (query) {
    filtered = filtered.filter((server) =>
      [server.name, server.description, commandPreview(server)].some((text) => text.toLowerCase().includes(query))
    )
  }

  return [...filtered].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
}
