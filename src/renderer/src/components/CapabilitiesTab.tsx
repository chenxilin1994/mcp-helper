import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MCPServerConfig } from '@shared/types'
import { Badge, Button, EmptyState, Segmented, Skeleton, cx } from './primitives'
import { Icon } from './Icons'
import { JsonBlock } from '../lib/json'
import { Runner, ResultView, capabilityFields } from './Runner'
import { formatLatency, truncate } from '../lib/format'
import { initialValues, toArguments } from '../lib/schema'
import { goTo, loadCaps, runPrompt, runResource, runTool, setTab } from '../state/actions'
import { useStore } from '../state/store'
import type { RunResult } from '../state/store'

interface CapItem {
  id: string
  name: string
  title?: string
  description?: string
  raw: unknown
}

export function CapabilitiesTab({ server }: { server: MCPServerConfig }): ReactNode {
  const { caps, view, busy, runs, capture, runtime } = useStore()
  const state = caps[server.id]
  const data = state?.data
  const kind = view.capKind
  const autorunDone = useRef(false)
  const connection = runtime[server.id]
  const stale = Boolean(data) && !state?.loading && (connection?.status ?? 'disconnected') !== 'ready'

  useEffect(() => {
    void loadCaps(server.id)
  }, [server.id])

  const items = useMemo<CapItem[]>(() => {
    if (!data) return []
    if (kind === 'tools') {
      return data.tools.map((tool) => ({
        id: tool.name,
        name: tool.name,
        title: tool.title,
        description: tool.description,
        raw: tool
      }))
    }
    if (kind === 'resources') {
      return data.resources.map((resource) => ({
        id: resource.uri,
        name: resource.name || resource.uri,
        title: resource.title,
        description: resource.description,
        raw: resource
      }))
    }
    return data.prompts.map((prompt) => ({
      id: prompt.name,
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      raw: prompt
    }))
  }, [data, kind])

  const selectedId = view.capItem
  const selected = items.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && items.length) {
      goTo({ ...view, capItem: items[0].id }, { replace: true })
    }
  }, [items, selectedId, view])

  useEffect(() => {
    if (!capture || autorunDone.current) return
    if (!view.autorun || !selected || kind !== 'tools') return
    autorunDone.current = true
    const fields = capabilityFields(selected.raw as Parameters<typeof capabilityFields>[0])
    void runTool(server.id, selected.id, toArguments(fields, initialValues(fields)))
  }, [capture, view.autorun, selected, kind, server.id])

  const serverRuns = runs[server.id] ?? []
  const expectedKind: RunResult['kind'] = kind === 'tools' ? 'tool' : kind === 'resources' ? 'resource' : 'prompt'
  const lastRun: RunResult | undefined = selected
    ? serverRuns.find(
        (run) =>
          run.kind === expectedKind &&
          (run.kind === 'resource' ? run.uri === selected.id : run.name === selected.id)
      )
    : undefined

  const running = selected
    ? busy[`run:${server.id}:${selected.id}`] === true
    : false

  const severity = ((): { label: string; tone: 'neutral' | 'warn' | 'err' } | null => {
    if (kind !== 'tools' || !selected) return null
    const annotations = (selected.raw as { annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }).annotations
    if (annotations?.destructiveHint) return { label: '破坏性操作', tone: 'err' }
    if (annotations?.readOnlyHint) return { label: '只读', tone: 'neutral' }
    return null
  })()

  return (
    <div className="caps">
      <div className="caps__bar">
        <Segmented
          size="sm"
          value={kind}
          ariaLabel="能力类型"
          onChange={(next) => goTo({ ...view, capKind: next, capItem: null })}
          options={[
            { value: 'tools', label: '工具', icon: 'wrench', count: data?.tools.length },
            { value: 'resources', label: '资源', icon: 'file', count: data?.resources.length },
            { value: 'prompts', label: '提示词', icon: 'message', count: data?.prompts.length }
          ]}
        />
        <span className="caps__meta tnum">
          {data
            ? `枚举耗时 ${formatLatency(data.durationMs)}${data.resourceTemplates.length ? ` · ${data.resourceTemplates.length} 个资源模板` : ''}`
            : ''}
        </span>
        <Button size="sm" variant="ghost" icon="refresh" loading={state?.loading} onClick={() => void loadCaps(server.id, true)}>
          重新枚举
        </Button>
      </div>

      {state?.loading && !data ? (
        <div className="caps__body">
          <div className="caps__list">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="cap-item cap-item--skeleton" key={index}>
                <Skeleton width={`${60 + ((index * 13) % 30)}%`} height={12} />
                <Skeleton width="85%" height={10} />
              </div>
            ))}
          </div>
          <div className="caps__detail">
            <Skeleton width="40%" height={18} />
            <Skeleton width="100%" height={90} />
          </div>
        </div>
      ) : null}

      {state?.error && !data ? (
        <EmptyState
          icon="alert"
          title="无法枚举能力"
          description={<span className="mono">{state.error}</span>}
        >
          <Button size="sm" icon="refresh" onClick={() => void loadCaps(server.id, true)}>
            重试
          </Button>
          <Button size="sm" variant="ghost" icon="terminal" onClick={() => setTab(server.id, 'logs')}>
            查看日志
          </Button>
        </EmptyState>
      ) : null}

      {stale ? (
        <div className="caps__notice">
          <Icon name="alert" size={14} />
          <span>
            连接已断开，以下清单来自 {state?.at ? new Date(state.at).toLocaleTimeString('zh-CN', { hour12: false }) : '上次'} 的枚举。
          </span>
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => void loadCaps(server.id, true)}>
            重新枚举
          </Button>
        </div>
      ) : null}

      {data ? (
        <div className="caps__body">
          <div className="caps__list" role="listbox" aria-label="能力列表">
            {items.length === 0 ? (
              <p className="caps__list-empty">
                该服务器未声明{kind === 'tools' ? '工具' : kind === 'resources' ? '资源' : '提示词'}能力
              </p>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === selectedId}
                  key={item.id}
                  className={cx('cap-item', item.id === selectedId && 'is-active')}
                  onClick={() => goTo({ ...view, capItem: item.id })}
                >
                  <span className="cap-item__name mono">{item.title || item.name}</span>
                  {item.title ? <span className="cap-item__id mono">{item.name}</span> : null}
                  {item.description ? <span className="cap-item__desc">{truncate(item.description, 90)}</span> : null}
                </button>
              ))
            )}

            {kind === 'resources' && data.resourceTemplates.length ? (
              <>
                <p className="side-label caps__group-label">资源模板</p>
                {data.resourceTemplates.map((template) => (
                  <div className="cap-item cap-item--template" key={template.uriTemplate}>
                    <span className="cap-item__name mono">{template.name || template.uriTemplate}</span>
                    <span className="cap-item__id mono">{template.uriTemplate}</span>
                    {template.description ? <span className="cap-item__desc">{truncate(template.description, 90)}</span> : null}
                  </div>
                ))}
              </>
            ) : null}
          </div>

          <div className="caps__detail">
            {!selected ? (
              <EmptyState compact icon="hand" title="从左侧选择一项" description="查看定义并直接测试调用" />
            ) : (
              <div className="cap-detail">
                <header className="cap-detail__head">
                  <div className="cap-detail__titles">
                    <h3 className="cap-detail__title">{selected.title || selected.name}</h3>
                    <code className="cap-detail__id mono">{selected.id}</code>
                  </div>
                  {severity ? <Badge tone={severity.tone}>{severity.label}</Badge> : null}
                </header>

                {selected.description ? <p className="cap-detail__desc">{selected.description}</p> : null}

                {kind !== 'resources' ? (
                  <section className="cap-detail__section">
                    <h4 className="cap-detail__section-title">参数定义</h4>
                    <SchemaTable schema={kind === 'tools' ? (selected.raw as { inputSchema?: unknown }).inputSchema : undefined} kind={kind} raw={selected.raw} />
                  </section>
                ) : (
                  <section className="cap-detail__section">
                    <h4 className="cap-detail__section-title">资源信息</h4>
                    <div className="rows">
                      <div className="rows__row">
                        <dt>URI</dt>
                        <dd className="mono">{selected.id}</dd>
                      </div>
                      <div className="rows__row">
                        <dt>MIME</dt>
                        <dd className="mono">{(selected.raw as { mimeType?: string }).mimeType || '未声明'}</dd>
                      </div>
                    </div>
                  </section>
                )}

                <section className="cap-detail__section">
                  {kind === 'resources' ? <h4 className="cap-detail__section-title">读取测试</h4> : null}
                  {kind === 'resources' ? (
                    <div className="runner">
                      <div className="runner__foot runner__foot--inline">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="play"
                          loading={running}
                          onClick={() => void runResource(server.id, selected.id)}
                        >
                          读取资源
                        </Button>
                        <span className="runner__server mono">{selected.id}</span>
                      </div>
                    </div>
                  ) : (
                    <Runner
                      key={selected.id}
                      server={server}
                      kind={kind === 'tools' ? 'tool' : 'prompt'}
                      name={selected.id}
                      fields={capabilityFields(selected.raw as Parameters<typeof capabilityFields>[0])}
                      running={running}
                      onRun={(args) => {
                        if (kind === 'tools') void runTool(server.id, selected.id, args)
                        else void runPrompt(server.id, selected.id, args as Record<string, string>)
                      }}
                    />
                  )}
                </section>

                {lastRun ? (
                  <section className="cap-detail__section">
                    <h4 className="cap-detail__section-title">最近一次结果</h4>
                    <ResultView run={lastRun} />
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SchemaTable({ schema, kind, raw }: { schema: unknown; kind: string; raw: unknown }): ReactNode {
  const fields = schema ? capabilityFields({ inputSchema: schema }) : kind === 'prompts' ? capabilityFields(raw as { arguments?: Array<{ name: string; description?: string; required?: boolean }> }) : []

  if (!fields.length) {
    return <p className="cap-detail__hint">{kind === 'prompts' ? '该提示词不需要参数' : '该工具不需要参数'}</p>
  }

  return (
    <div className="schema">
      <table className="schema-table">
        <thead>
          <tr>
            <th>参数</th>
            <th>类型</th>
            <th>必填</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name}>
              <td className="mono schema-table__name">{field.name}</td>
              <td className="mono">
                {field.options?.length ? field.options.join(' | ') : field.kind === 'string-list' ? 'string[]' : field.kind === 'json' ? 'object' : field.kind}
              </td>
              <td>{field.required ? '是' : '—'}</td>
              <td className="schema-table__desc">{field.description ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {kind === 'tools' ? (
        <details className="schema__raw">
          <summary>原始 JSON Schema</summary>
          <JsonBlock value={schema} maxHeight={260} />
        </details>
      ) : null}
    </div>
  )
}
