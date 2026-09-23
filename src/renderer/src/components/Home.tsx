import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ClientTarget } from '@shared/types'
import { Button, EmptyState, StatusDot } from './primitives'
import { Icon } from './Icons'
import { formatLatency, relativeTime } from '../lib/format'
import { goTo, openDialog, openServer, testAll } from '../state/actions'
import { useStore } from '../state/store'

export function HomePane(): ReactNode {
  const { app, busy } = useStore()
  const servers = app?.servers ?? []
  const [targets, setTargets] = useState<ClientTarget[]>([])

  useEffect(() => {
    window.api.clientTargets().then(setTargets).catch(() => undefined)
  }, [])

  const importable = targets.filter((target) => target.available && target.serverCount > 0)

  const recent = useMemo(
    () =>
      servers
        .filter((server) => server.lastTest)
        .sort((a, b) => (b.lastTest?.at ?? 0) - (a.lastTest?.at ?? 0))
        .slice(0, 5),
    [servers]
  )

  if (servers.length === 0) {
    return (
      <section className="detail detail--empty">
        <div className="onboarding">
          <span className="onboarding__mark">
            <Icon name="bus" size={26} />
          </span>
          <h2 className="onboarding__title">把散落各处的 MCP 接到一块背板上</h2>
          <p className="onboarding__desc">
            统一管理配置与分组，随时验证连通性，直接枚举工具、资源与提示词并测试调用。
          </p>
          <div className="onboarding__actions">
            <Button
              variant="primary"
              icon="plus"
              onClick={() =>
                goTo({ mode: 'create', serverId: null, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
              }
            >
              新建 MCP
            </Button>
            <Button icon="import" onClick={() => openDialog('import')}>
              从客户端导入
            </Button>
          </div>

          {importable.length ? (
            <div className="onboarding__detected">
              <p className="onboarding__detected-title">检测到可导入的现有配置</p>
              {importable.map((target) => (
                <button key={target.id} type="button" className="onboarding__client" onClick={() => openDialog('import')}>
                  <span className="onboarding__client-name">{target.name}</span>
                  <span className="onboarding__client-count tnum">{target.serverCount} 个 MCP</span>
                  <Icon name="chevronRight" size={14} />
                </button>
              ))}
            </div>
          ) : (
            <p className="onboarding__hint">
              没有检测到现有客户端配置。点击「新建 MCP」可从快速模板开始，例如官方 Everything 参考服务器。
            </p>
          )}

          <p className="onboarding__shortcuts">
            <kbd>Ctrl</kbd> + <kbd>N</kbd> 新建 · <kbd>Ctrl</kbd> + <kbd>K</kbd> 搜索
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="detail detail--empty">
      <div className="home">
        <EmptyState icon="hand" title="选择左侧的服务器" description="查看传输配置、枚举能力，或直接测试工具调用。">
          <Button size="sm" variant="ghost" icon="pulse" loading={busy['test:all']} onClick={() => void testAll()}>
            全部测试
          </Button>
        </EmptyState>

        <div className="recent">
          <p className="recent__title">最近测试</p>
          {recent.length === 0 ? (
            <p className="recent__empty">还没有测试记录。测试一次后，这里会按时间列出每个服务器的握手结果。</p>
          ) : (
            recent.map((server) => (
              <button key={server.id} type="button" className="recent__row" onClick={() => openServer(server.id)}>
                <StatusDot status={server.lastTest?.status === 'ok' ? 'ready' : 'error'} size={7} />
                <span className="recent__name">{server.name}</span>
                <span className="recent__result mono tnum">
                  {server.lastTest?.status === 'ok' ? formatLatency(server.lastTest.latencyMs) : '失败'}
                </span>
                <span className="recent__time">{server.lastTest ? relativeTime(server.lastTest.at) : ''}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
