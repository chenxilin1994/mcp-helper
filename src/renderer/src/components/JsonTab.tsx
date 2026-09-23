import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ClientTarget, MCPServerConfig } from '@shared/types'
import { Button, CopyButton, Field, Select, cx } from './primitives'
import { JsonBlock } from '../lib/json'
import { copyText } from '../lib/clipboard'
import { compactPath } from '../lib/format'
import { pushToast, setState, useStore } from '../state/store'

export function JsonTab({ server }: { server: MCPServerConfig }): ReactNode {
  const [targets, setTargets] = useState<ClientTarget[]>([])
  const [clientId, setClientId] = useState('cursor')
  const [json, setJson] = useState('')
  const [writing, setWriting] = useState(false)
  const confirm = useStore()

  useEffect(() => {
    window.api
      .clientTargets()
      .then((list) => {
        setTargets(list)
        const preferred = list.find((target) => target.id === 'cursor')
        setClientId(preferred?.id ?? list[0]?.id ?? 'cursor')
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.api
      .exportClient({ clientId, ids: [server.id], write: false })
      .then((result) => {
        if (!cancelled) setJson(result.json)
      })
      .catch((error: unknown) => {
        if (!cancelled) setJson(`// 导出失败\n// ${error instanceof Error ? error.message : String(error)}`)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, server.id, server.updatedAt])

  const target = useMemo(() => targets.find((item) => item.id === clientId), [targets, clientId])

  const writeToClient = async (): Promise<void> => {
    setWriting(true)
    try {
      const result = await window.api.exportClient({ clientId, ids: [server.id], write: true })
      pushToast({
        kind: 'success',
        title: `已写入 ${target?.name ?? clientId} 配置`,
        message: result.backup ? `原配置已备份为 ${result.backup}` : result.path
      })
    } catch (error) {
      pushToast({ kind: 'error', title: '写入失败', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setWriting(false)
    }
  }

  const confirmWrite = (): void => {
    setState({
      confirm: {
        title: `写入 ${target?.name} 配置？`,
        message: `将把「${server.name}」合并进 ${target?.configPath}，写入前会自动备份原文件。`,
        confirmLabel: '写入配置',
        onConfirm: writeToClient
      }
    })
  }

  return (
    <div className="pane-scroll">
      <section className="card">
        <header className="card__head">
          <div className="card__titles">
            <h3 className="card__title">导出为客户端配置</h3>
            <p className="card__desc">将当前 MCP 转换为其他客户端的配置片段，可直接复制或写入其配置文件。</p>
          </div>
          <div className="card__actions">
            <Button size="sm" icon="copy" onClick={() => void copyText(json).then((ok) => pushToast({ kind: ok ? 'success' : 'error', title: ok ? '已复制 JSON' : '复制失败' }))}>
              复制
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon="export"
              loading={writing}
              disabled={!target?.available && target?.id !== 'cursor'}
              onClick={confirmWrite}
            >
              写入配置
            </Button>
          </div>
        </header>

        <div className="card__body">
          <div className="json-tab__pick">
            <Field label="目标客户端" hint={target ? <span className="mono" title={target.configPath}>{compactPath(target.configPath, 3)}</span> : undefined}>
              <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.available ? ` · 已发现 ${item.serverCount} 个` : ' · 配置文件未找到'}
                  </option>
                ))}
              </Select>
            </Field>
            {target && !target.available ? (
              <p className={cx('notice')}>
                未找到该客户端的配置文件，写入时会新建 <span className="mono">{target.configPath}</span>。
              </p>
            ) : null}
          </div>
          <JsonBlock value={json} maxHeight={420} />
        </div>
      </section>

      <section className="card">
        <header className="card__head">
          <h3 className="card__title">MCP Helper 存储格式</h3>
          <div className="card__actions">
            <CopyButton text={JSON.stringify(server, null, 2)} label="复制完整配置" size={26} />
          </div>
        </header>
        <div className="card__body">
          <JsonBlock value={server} maxHeight={300} />
        </div>
      </section>
    </div>
  )
}
