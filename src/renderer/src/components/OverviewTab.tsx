import { useMemo, useState, type ReactNode } from 'react'
import type { MCPServerConfig } from '@shared/types'
import { Badge, Button, CopyButton, cx } from './primitives'
import { Icon, TransportGlyph } from './Icons'
import { ProbeTrace } from './ProbeTrace'
import { formatDateTime, formatLatency, isSecretKey, maskValue, relativeTime, transportLabel } from '../lib/format'
import { testServer } from '../state/actions'
import { useStore } from '../state/store'

function Row({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }): ReactNode {
  return (
    <div className="rows__row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  )
}

function PairList({ title, entries, reveal }: { title: string; entries: Record<string, string>; reveal: boolean }): ReactNode {
  const keys = Object.keys(entries)
  return (
    <div className="pair-list">
      <p className="pair-list__title">{title}</p>
      {keys.length === 0 ? (
        <p className="pair-list__empty">未设置</p>
      ) : (
        <div className="pair-list__items">
          {keys.map((key) => (
            <div className="pair-list__item" key={key}>
              <span className="pair-list__key mono">{key}</span>
              <span className={cx('pair-list__value mono', isSecretKey(key) && !reveal && 'is-masked')}>
                {isSecretKey(key) && !reveal ? maskValue(entries[key]) : entries[key]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function OverviewTab({ server }: { server: MCPServerConfig }): ReactNode {
  const { runtime, probe } = useStore()
  const state = runtime[server.id]
  const status = state?.status ?? 'disconnected'
  const testing = state?.testing ?? false
  const probeState = probe[server.id]
  const [revealSecrets, setRevealSecrets] = useState(false)

  const hasSecrets = useMemo(
    () => [...Object.keys(server.env), ...Object.keys(server.headers)].some((key) => isSecretKey(key)),
    [server.env, server.headers]
  )

  const capabilityChips = useMemo(() => {
    const capabilities = (server.lastTest?.serverInfo?.capabilities ?? {}) as Record<string, unknown>
    return Object.keys(capabilities).filter((key) => capabilities[key] != null && capabilities[key] !== false)
  }, [server.lastTest])

  const configJson = useMemo(() => JSON.stringify(server, null, 2), [server])
  const lastTest = server.lastTest
  const probing = probeState?.running === true || testing

  return (
    <div className="pane-scroll">
      {server.description ? <p className="overview__desc">{server.description}</p> : null}

      <div className="overview__grid">
        <section className="card">
          <header className="card__head">
            <div className="card__titles">
              <h3 className="card__title">传输配置</h3>
              <p className="card__desc">
                {server.transport === 'stdio' ? '本地子进程，标准输入输出通信' : `${transportLabel(server.transport)} 远端连接`}
              </p>
            </div>
            <div className="card__actions">
              <CopyButton text={configJson} label="复制配置" size={26} />
            </div>
          </header>
          <div className="card__body">
            <dl className="rows">
              <Row label="传输">
                <span className="transport-line">
                  <TransportGlyph transport={server.transport} size={15} className="transport-line__glyph" />
                  <span className="mono">{transportLabel(server.transport)}</span>
                </span>
              </Row>
              {server.transport === 'stdio' ? (
                <>
                  <Row label="命令" mono>
                    {server.command || '未设置'}
                  </Row>
                  <Row label="参数" mono>
                    {server.args.filter(Boolean).length ? (
                      <span className="args">
                        {server.args.filter(Boolean).map((arg, index) => (
                          <span className="args__item mono" key={index}>
                            {arg}
                          </span>
                        ))}
                      </span>
                    ) : (
                      '无'
                    )}
                  </Row>
                  <Row label="工作目录" mono>
                    {server.cwd || '继承应用目录'}
                  </Row>
                </>
              ) : (
                <Row label="地址" mono>
                  {server.url || '未设置'}
                </Row>
              )}
            </dl>

            {server.transport === 'stdio' ? (
              <PairList title="环境变量" entries={server.env} reveal={revealSecrets} />
            ) : (
              <PairList title="请求头" entries={server.headers} reveal={revealSecrets} />
            )}

            {hasSecrets ? (
              <button type="button" className="link-btn" onClick={() => setRevealSecrets((value) => !value)}>
                <Icon name={revealSecrets ? 'eyeOff' : 'eye'} size={14} />
                {revealSecrets ? '隐藏敏感值' : '显示敏感值'}
              </button>
            ) : null}
          </div>
        </section>

        <section className="card">
          <header className="card__head">
            <div className="card__titles">
              <h3 className="card__title">连接状态</h3>
              <p className="card__desc">{probing ? '正在探测握手链路' : '最近一次连通性测试'}</p>
            </div>
            <div className="card__actions">
              <Button size="sm" variant="ghost" icon="pulse" loading={probing} onClick={() => void testServer(server.id)}>
                测试
              </Button>
            </div>
          </header>
          <div className="card__body">
            <div className="readout">
              <div className="readout__cell">
                <span className="readout__label">状态</span>
                <span className="readout__value">
                  <Badge tone={probing ? 'warn' : lastTest ? (lastTest.status === 'ok' ? 'ok' : 'err') : 'neutral'}>
                    {probing ? '探测中' : lastTest ? (lastTest.status === 'ok' ? '连通' : '失败') : '未测试'}
                  </Badge>
                </span>
              </div>
              <div className="readout__cell">
                <span className="readout__label">上次测试</span>
                <span className="readout__value mono tnum">{lastTest ? relativeTime(lastTest.at) : '—'}</span>
              </div>
              <div className="readout__cell">
                <span className="readout__label">协议</span>
                <span className="readout__value mono">{lastTest?.serverInfo?.protocolVersion || '—'}</span>
              </div>
            </div>

            <ProbeTrace transport={server.transport} probe={probeState} stages={lastTest?.stages} />

            {lastTest?.status === 'error' ? <p className="test-error mono">{lastTest.error}</p> : null}

            {lastTest?.status === 'ok' ? (
              <>
                <dl className="rows">
                  <Row label="服务名" mono>
                    {lastTest.serverInfo?.title || lastTest.serverInfo?.name || '—'}
                  </Row>
                  <Row label="版本" mono>
                    {lastTest.serverInfo?.version || '—'}
                  </Row>
                  <Row label="总耗时" mono>
                    <span className="tnum">{formatLatency(lastTest.latencyMs)}</span>
                  </Row>
                </dl>
                {capabilityChips.length ? (
                  <div className="chips">
                    {capabilityChips.map((chip) => (
                      <Badge key={chip} tone="accent">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {!lastTest && !probing ? (
              <p className="test-empty__hint">
                还没有测试记录。运行一次测试，可以看到从启动到心跳的每一段耗时。
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {lastTest?.serverInfo?.instructions ? (
        <section className="card">
          <header className="card__head">
            <div className="card__titles">
              <h3 className="card__title">服务器指令</h3>
              <p className="card__desc">服务端在 initialize 阶段返回的 instructions</p>
            </div>
            <div className="card__actions">
              <CopyButton text={lastTest.serverInfo.instructions} label="复制" size={26} />
            </div>
          </header>
          <div className="card__body">
            <pre className="code-block code-block--plain">{lastTest.serverInfo.instructions}</pre>
          </div>
        </section>
      ) : null}
    </div>
  )
}
