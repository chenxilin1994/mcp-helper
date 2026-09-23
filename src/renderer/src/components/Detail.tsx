import { useMemo, type ReactNode } from 'react'
import type { MCPServerConfig } from '@shared/types'
import { Badge, Button, CopyButton, EmptyState, MenuButton, StatusDot, cx, type MenuItem } from './primitives'
import { TransportGlyph } from './Icons'
import { OverviewTab } from './OverviewTab'
import { CapabilitiesTab } from './CapabilitiesTab'
import { LogsTab } from './LogsTab'
import { JsonTab } from './JsonTab'
import { commandPreview, groupColor, statusLabel, truncate } from '../lib/format'
import {
  clearRuns,
  connectServer,
  deleteServer,
  disconnectServer,
  duplicateServer,
  goTo,
  setTab,
  testServer,
  toggleEnabled,
  toggleFavorite
} from '../state/actions'
import { useStore } from '../state/store'

const TABS = [
  { id: 'overview', label: '概览' },
  { id: 'caps', label: '能力' },
  { id: 'logs', label: '日志' },
  { id: 'json', label: 'JSON' }
] as const

export function Detail({ server }: { server: MCPServerConfig }): ReactNode {
  const { app, runtime, view, runs, logs } = useStore()
  const state = runtime[server.id]
  const status = state?.status ?? 'disconnected'
  const testing = state?.testing ?? false
  const group = app?.groups.find((item) => item.id === server.groupId)
  const capsData = useStore().caps[server.id]?.data

  const capCount = useMemo(() => {
    if (!capsData) return null
    return capsData.tools.length + capsData.resources.length + capsData.prompts.length
  }, [capsData])

  const tabCount: Partial<Record<(typeof TABS)[number]['id'], number>> = {}
  if (capCount !== null) tabCount.caps = capCount
  const logCount = logs[server.id]?.length ?? 0
  if (logCount) tabCount.logs = logCount

  const menu: MenuItem[] = [
    { label: server.favorite ? '取消收藏' : '收藏', icon: 'star', onSelect: () => void toggleFavorite(server.id) },
    { label: server.enabled ? '停用' : '启用', icon: 'power', onSelect: () => void toggleEnabled(server.id) },
    { separator: true },
    { label: '复制一份', icon: 'copy', onSelect: () => void duplicateServer(server.id) },
    { label: '清空调用记录', icon: 'trash', onSelect: () => clearRuns(server.id), disabled: !runs[server.id]?.length },
    { separator: true },
    { label: '删除', icon: 'trash', danger: true, onSelect: () => deleteServer(server.id) }
  ]

  return (
    <section className="detail">
      <header className="detail__head">
        <div className="detail__top">
          <div className="detail__ident">
            <div className="detail__name-row">
              <h2 className="detail__name">{server.name}</h2>
              {server.favorite ? <Badge tone="warn" icon="starFilled">收藏</Badge> : null}
              {!server.enabled ? <Badge>已停用</Badge> : null}
            </div>
            <div className="detail__meta">
              <span className="detail__status">
                <StatusDot status={status} pulse={testing} />
                <span>{statusLabel(status)}</span>
              </span>
              {group ? (
                <span className="detail__group">
                  <span className="side-item__dot" style={{ background: groupColor(group.color) }} />
                  {group.name}
                </span>
              ) : null}
              {state?.error ? (
                <span className="detail__error" title={state.error}>
                  {truncate(state.error, 72)}
                </span>
              ) : null}
            </div>
            <p className="detail__wire">
              <TransportGlyph transport={server.transport} size={13} className="detail__wire-glyph" />
              <span className="detail__wire-text mono">{commandPreview(server)}</span>
              <CopyButton text={commandPreview(server)} label="复制命令或地址" size={22} />
            </p>
          </div>

          <div className="detail__actions">
            <Button size="sm" icon="pulse" loading={testing} onClick={() => void testServer(server.id)}>
              测试连接
            </Button>
            {status === 'ready' ? (
              <Button size="sm" variant="ghost" icon="power" onClick={() => void disconnectServer(server.id)}>
                断开
              </Button>
            ) : (
              <Button size="sm" variant="ghost" icon="plug" loading={testing} onClick={() => void connectServer(server.id)}>
                连接
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon="pencil"
              onClick={() => goTo({ mode: 'edit', serverId: server.id, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })}
            >
              编辑
            </Button>
            <MenuButton items={menu} label="更多操作" />
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="详情视图">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view.tab === tab.id}
              className={cx('tab', view.tab === tab.id && 'is-active')}
              onClick={() => setTab(server.id, tab.id)}
            >
              {tab.label}
              {tabCount[tab.id] !== undefined ? <span className="tab__count tnum">{tabCount[tab.id]}</span> : null}
            </button>
          ))}
          {testing ? <span className="tabs__sweep" aria-hidden="true" /> : null}
        </div>
      </header>

      <div className="detail__body">
        {view.tab === 'overview' ? <OverviewTab server={server} /> : null}
        {view.tab === 'caps' ? <CapabilitiesTab server={server} /> : null}
        {view.tab === 'logs' ? <LogsTab server={server} /> : null}
        {view.tab === 'json' ? <JsonTab server={server} /> : null}
      </div>
    </section>
  )
}

export function DetailPlaceholder(): ReactNode {
  return (
    <section className="detail detail--empty">
      <EmptyState
        icon="hand"
        title="从未选择服务器"
        description="在左侧列表中选择一个 MCP 查看配置、枚举能力并测试调用。"
      />
    </section>
  )
}
