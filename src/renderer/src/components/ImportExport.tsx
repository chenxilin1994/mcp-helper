import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ClientTarget, ImportedServer, ParseResult } from '@shared/types'
import { Badge, Button, Dialog, Field, Input, Segmented, Select, Switch, Textarea, cx } from './primitives'
import { Icon } from './Icons'
import { JsonBlock } from '../lib/json'
import { copyText } from '../lib/clipboard'
import { compactPath } from '../lib/format'
import { pushToast, useStore } from '../state/store'
import { closeDialog, importServers } from '../state/actions'

export function ImportExportDialog(): ReactNode {
  const { dialog, app } = useStore()
  const [tab, setTab] = useState<'import' | 'export'>('import')

  return (
    <Dialog open={dialog === 'import'} onClose={closeDialog} title="导入 / 导出 MCP 配置" width={760}>
      <Segmented
        value={tab}
        ariaLabel="导入或导出"
        onChange={setTab}
        options={[
          { value: 'import', label: '导入', icon: 'import' },
          { value: 'export', label: '导出', icon: 'export' }
        ]}
      />
      <div className="io">
        {tab === 'import' ? <ImportPane /> : <ExportPane />}
      </div>
    </Dialog>
  )
}

function ImportPane(): ReactNode {
  const { app } = useStore()
  const [targets, setTargets] = useState<ClientTarget[]>([])
  const [source, setSource] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [groupName, setGroupName] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    window.api.clientTargets().then(setTargets).catch(() => undefined)
  }, [])

  const existing = useMemo(() => new Set((app?.servers ?? []).map((server) => server.name)), [app?.servers])

  const applyParse = (result: ParseResult, options?: { groupName?: string; busy?: string }): void => {
    setParsed(result)
    const selection: Record<string, boolean> = {}
    for (const server of result.servers) selection[server.name] = !existing.has(server.name)
    setSelected(selection)
    setGroupName(options?.groupName ?? '')
    setBusyKey(options?.busy ?? null)
    if (!result.servers.length && result.warnings.length) {
      pushToast({ kind: 'error', title: '没有可导入的条目', message: result.warnings[0] })
    }
  }

  const loadClient = async (target: ClientTarget): Promise<void> => {
    setSource(target.id)
    setBusyKey(target.id)
    try {
      const result = await window.api.parseImport({ clientId: target.id })
      applyParse(result, { groupName: target.name })
    } catch (error) {
      pushToast({ kind: 'error', title: `读取 ${target.name} 失败`, message: error instanceof Error ? error.message : String(error) })
      setParsed(null)
    } finally {
      setBusyKey(null)
    }
  }

  const loadPaste = async (): Promise<void> => {
    setSource('paste')
    setBusyKey('paste')
    try {
      const result = await window.api.parseImport({ json: pasteText })
      applyParse(result, { groupName: '' })
      setPasteOpen(false)
    } catch (error) {
      pushToast({ kind: 'error', title: '解析失败', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusyKey(null)
    }
  }

  const chosen = (parsed?.servers ?? []).filter((server) => selected[server.name])
  const total = Object.values(selected).filter(Boolean).length

  const runImport = async (): Promise<void> => {
    if (!chosen.length) {
      pushToast({ kind: 'info', title: '请先选择要导入的条目' })
      return
    }
    const ok = await importServers(chosen as ImportedServer[], groupName.trim() || undefined)
    if (ok) closeDialog()
  }

  return (
    <div className="io__pane">
      <p className="io__label">从已安装的客户端读取</p>
      <div className="io__sources">
        {targets.map((target) => (
          <button
            key={target.id}
            type="button"
            className={cx('io__source', source === target.id && 'is-active', !target.available && 'is-missing')}
            onClick={() => void loadClient(target)}
            disabled={!target.available || busyKey === target.id}
          >
            <span className="io__source-head">
              <Icon name="server" size={15} />
              <span className="io__source-name">{target.name}</span>
              {!target.available ? (
                <Badge>未找到</Badge>
              ) : target.serverCount > 0 ? (
                <Badge tone="ok">{target.serverCount} 个</Badge>
              ) : (
                <Badge>无 MCP</Badge>
              )}
            </span>
            <span className="io__source-path mono" title={target.configPath}>
              {compactPath(target.configPath)}
            </span>
          </button>
        ))}
      </div>

      <button type="button" className="link-btn io__paste-toggle" onClick={() => setPasteOpen((value) => !value)}>
        <Icon name={pasteOpen ? 'chevronDown' : 'chevronRight'} size={14} />
        或粘贴 JSON 配置
      </button>

      {pasteOpen ? (
        <div className="io__paste">
          <Textarea
            className="mono"
            rows={6}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={'{\n  "mcpServers": { "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem"] } }\n}'}
            spellCheck={false}
          />
          <div className="io__paste-actions">
            <Button size="sm" icon="import" loading={busyKey === 'paste'} onClick={() => void loadPaste()} disabled={!pasteText.trim()}>
              解析
            </Button>
          </div>
        </div>
      ) : null}

      {parsed ? (
        <div className="io__preview">
          <div className="io__preview-head">
            <p className="io__label">
              发现 {parsed.servers.length} 个 MCP {parsed.source ? `（${parsed.source}）` : ''}
            </p>
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                setSelected(
                  Object.fromEntries(parsed.servers.map((server) => [server.name, total !== parsed.servers.length]))
                )
              }
            >
              {total === parsed.servers.length ? '全部取消' : '全部选择'}
            </button>
          </div>

          {parsed.warnings.map((warning) => (
            <p className="io__warning" key={warning}>
              <Icon name="alert" size={14} />
              {warning}
            </p>
          ))}

          <div className="io__list">
            {parsed.servers.map((server) => {
              const duplicate = existing.has(server.name)
              return (
                <label className={cx('io__row', duplicate && 'is-duplicate')} key={server.name}>
                  <input
                    type="checkbox"
                    checked={selected[server.name] === true}
                    onChange={(event) => setSelected((current) => ({ ...current, [server.name]: event.target.checked }))}
                  />
                  <span className="io__row-main">
                    <span className="io__row-name">
                      {server.name}
                      {duplicate ? <span className="io__dup-tag">已存在</span> : null}
                    </span>
                    <span className="io__row-cmd mono">
                      {server.transport === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ') : server.url}
                    </span>
                  </span>
                  <Badge mono>{server.transport === 'stdio' ? 'stdio' : server.transport.toUpperCase()}</Badge>
                </label>
              )
            })}
          </div>

          <div className="io__options">
            <Field label="导入到分组" hint="留空则不分组；同名分组会自动复用">
              <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="例如：Claude Desktop" />
            </Field>
            <Button variant="primary" size="sm" icon="import" onClick={() => void runImport()} disabled={!chosen.length}>
              导入 {chosen.length ? `(${chosen.length})` : ''}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ExportPane(): ReactNode {
  const { app } = useStore()
  const [targets, setTargets] = useState<ClientTarget[]>([])
  const [clientId, setClientId] = useState('cursor')
  const [onlyEnabled, setOnlyEnabled] = useState(false)
  const [json, setJson] = useState('')
  const [writing, setWriting] = useState(false)

  useEffect(() => {
    window.api
      .clientTargets()
      .then((list) => {
        setTargets(list)
        if (!list.some((item) => item.id === clientId)) setClientId(list[0]?.id ?? 'cursor')
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const servers = app?.servers ?? []
  const ids = onlyEnabled ? servers.filter((server) => server.enabled).map((server) => server.id) : []

  useEffect(() => {
    let cancelled = false
    window.api
      .exportClient({ clientId, ids, write: false })
      .then((result) => {
        if (!cancelled) setJson(result.json)
      })
      .catch((error: unknown) => {
        if (!cancelled) setJson(`// 导出失败\n// ${error instanceof Error ? error.message : String(error)}`)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, ids.join(','), servers.length])

  const target = targets.find((item) => item.id === clientId)

  const doWrite = async (): Promise<void> => {
    setWriting(true)
    try {
      const result = await window.api.exportClient({ clientId, ids, write: true })
      pushToast({
        kind: 'success',
        title: `已写入 ${target?.name ?? clientId}`,
        message: result.backup ? `原配置已备份为 ${result.backup}` : result.path
      })
    } catch (error) {
      pushToast({ kind: 'error', title: '写入失败', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setWriting(false)
    }
  }

  return (
    <div className="io__pane">
      <div className="io__export-head">
        <Field label="目标客户端" hint={target ? <span className="mono" title={target.configPath}>{compactPath(target.configPath, 3)}</span> : undefined}>
          <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="范围">
          <div className="row-inline">
            <Switch checked={onlyEnabled} onChange={setOnlyEnabled} label="仅导出已启用的服务器" />
            <span className="row-inline__hint">共 {servers.length} 个，已启用 {servers.filter((server) => server.enabled).length} 个</span>
          </div>
        </Field>
      </div>

      <JsonBlock value={json} maxHeight={300} />

      <div className="io__export-actions">
        <Button
          size="sm"
          icon="copy"
          onClick={async () => {
            const ok = await copyText(json)
            pushToast({ kind: ok ? 'success' : 'error', title: ok ? '已复制 JSON' : '复制失败' })
          }}
        >
          复制 JSON
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="export"
          loading={writing}
          disabled={servers.length === 0 || (!target?.available && target?.id !== 'cursor')}
          onClick={() => void doWrite()}
        >
          写入配置
        </Button>
      </div>
      <p className="io__note">
        <Icon name="info" size={13} /> 写入会合并到目标客户端现有配置，并在同目录生成 <span className="mono">.mcp-helper.bak</span> 备份。
      </p>
    </div>
  )
}
