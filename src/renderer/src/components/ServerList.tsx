import { useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { MCPServerConfig } from '@shared/types'
import { Icon, TransportGlyph } from './Icons'
import { Button, EmptyState, IconButton, MenuButton, StatusDot, cx, type MenuItem } from './primitives'
import { commandPreview, formatLatency, groupColor, transportLabel, truncate } from '../lib/format'
import {
  deleteServer,
  duplicateServer,
  goTo,
  openServer,
  setSearch,
  shortcutHint,
  testAll,
  testServer,
  toggleEnabled,
  toggleFavorite
} from '../state/actions'
import { openContextMenu, useStore } from '../state/store'
import { selectVisibleServers } from '../state/selectors'

export function ServerList(): ReactNode {
  const state = useStore()
  const { app, search, groupFilter, view, busy } = state

  const servers = useMemo(() => selectVisibleServers(state), [state])

  const group = app?.groups.find((item) => item.id === groupFilter)
  const title = groupFilter === 'all' ? '全部服务器' : groupFilter === 'none' ? '未分组' : group?.name ?? '服务器'

  return (
    <section className="list">
      <header className="list__head">
        <div className="list__title-row">
          <h1 className="list__title">{title}</h1>
          <span className="list__count tnum">{servers.length}</span>
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            title={`新建 MCP（${shortcutHint('newServer')}）`}
            onClick={() => goTo({ mode: 'create', serverId: null, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })}
          >
            新建
          </Button>
        </div>
        <div className="list__tools">
          <div className="search" title={`搜索（${shortcutHint('search')}）`}>
            <Icon name="search" size={14} className="search__icon" />
            <input
              className="search__input"
              value={search}
              placeholder="搜索名称、命令或地址"
              onChange={(event) => setSearch(event.target.value)}
              spellCheck={false}
            />
            {search ? <IconButton icon="x" label="清除搜索" size={22} onClick={() => setSearch('')} /> : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon="pulse"
            loading={busy['test:all']}
            onClick={() => void testAll()}
            title={`依次测试所有服务器（${shortcutHint('testAll')}）`}
          >
            全部测试
          </Button>
        </div>
      </header>

      <div className="list__scroll">
        {servers.length === 0 ? (
          <EmptyState
            compact
            icon="server"
            title={app?.servers.length ? '没有匹配的服务器' : '还没有 MCP 服务器'}
            description={
              app?.servers.length ? '换个关键词，或切换到其他分组。' : '点击右上角「新建」，或从现有客户端导入配置。'
            }
          />
        ) : (
          servers.map((server) => (
            <ServerRow
              key={server.id}
              server={server}
              active={view.serverId === server.id}
              groupName={
                groupFilter === 'all' ? app?.groups.find((item) => item.id === server.groupId) : undefined
              }
            />
          ))
        )}
      </div>
    </section>
  )
}

function serverMenu(server: MCPServerConfig): MenuItem[] {
  return [
    { label: '测试连接', icon: 'pulse', onSelect: () => void testServer(server.id) },
    {
      label: '编辑',
      icon: 'pencil',
      onSelect: () =>
        goTo({ mode: 'edit', serverId: server.id, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
    },
    { label: '复制一份', icon: 'copy', onSelect: () => void duplicateServer(server.id) },
    { label: server.enabled ? '停用' : '启用', icon: 'power', onSelect: () => void toggleEnabled(server.id) },
    { separator: true },
    { label: '删除', icon: 'trash', danger: true, onSelect: () => deleteServer(server.id) }
  ]
}

function ServerRow({
  server,
  active,
  groupName
}: {
  server: MCPServerConfig
  active: boolean
  groupName?: { name: string; color: string }
}): ReactNode {
  const runtime = useStore().runtime[server.id]
  const status = runtime?.status ?? 'disconnected'
  const testing = runtime?.testing ?? false
  const menu = serverMenu(server)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openServer(server.id)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const rows = Array.from(document.querySelectorAll<HTMLElement>('.list__scroll .srow'))
      const index = rows.indexOf(event.currentTarget)
      const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)]
      if (next) {
        next.focus()
        next.click()
      }
    }
  }

  const onContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    openServer(server.id)
    openContextMenu(event.clientX, event.clientY, menu)
  }

  return (
    <div
      className={cx('srow', active && 'is-active', !server.enabled && 'is-disabled')}
      role="button"
      tabIndex={0}
      onClick={() => openServer(server.id)}
      onDoubleClick={() =>
        goTo({ mode: 'edit', serverId: server.id, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
      }
      onKeyDown={onKeyDown}
      onContextMenu={onContextMenu}
      aria-label={`${server.name}，${status === 'ready' ? '已连接' : '未连接'}`}
    >
      <span className="srow__status">
        <StatusDot status={status} pulse={testing} />
      </span>
      <div className="srow__main">
        <div className="srow__top">
          <span className="srow__name">{server.name}</span>
          {server.favorite ? <Icon name="starFilled" size={12} className="srow__fav" /> : null}
          {!server.enabled ? <span className="srow__off">已停用</span> : null}
        </div>
        <div className="srow__meta">
          <span className="transport">
            <TransportGlyph transport={server.transport} size={13} className="transport__glyph" />
            <span className="transport__text mono">{transportLabel(server.transport)}</span>
          </span>
          <span className="srow__cmd mono">{truncate(commandPreview(server), 42)}</span>
        </div>
        {groupName ? (
          <div className="srow__group">
            <span className="side-item__dot" style={{ background: groupColor(groupName.color) }} />
            <span>{groupName.name}</span>
          </div>
        ) : null}
      </div>
      <div className="srow__end">
        {server.lastTest ? (
          <span className={cx('srow__latency mono tnum', server.lastTest.status === 'error' && 'is-err')}>
            {server.lastTest.status === 'ok' ? formatLatency(server.lastTest.latencyMs) : '失败'}
          </span>
        ) : null}
        <div className="srow__actions">
          <IconButton
            icon={server.favorite ? 'starFilled' : 'star'}
            label={server.favorite ? '取消收藏' : '收藏'}
            size={24}
            className={cx('srow__star', server.favorite && 'is-on')}
            onClick={(event) => {
              event.stopPropagation()
              void toggleFavorite(server.id)
            }}
          />
          <MenuButton items={menu} label={`${server.name} 操作`} size={24} />
        </div>
      </div>
    </div>
  )
}
