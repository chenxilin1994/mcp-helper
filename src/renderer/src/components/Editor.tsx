import { useState, type ReactNode } from 'react'
import type { MCPServerConfig, ServerDraft, TransportType } from '@shared/types'
import { Button, Field, Input, KeyValueEditor, Segmented, Select, StringListEditor, Switch } from './primitives'
import { Icon, TransportGlyph } from './Icons'
import { goTo, saveServer } from '../state/actions'
import { useStore } from '../state/store'

interface Preset {
  name: string
  description: string
  command: string
  args: string[]
  note: string
}

const PRESETS: Preset[] = [
  {
    name: 'Memory',
    description: '官方知识图谱记忆服务',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    note: '适合验证工具枚举与调用'
  },
  {
    name: 'Sequential Thinking',
    description: '官方顺序思考推理服务',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    note: '单工具，参数带枚举'
  },
  {
    name: 'Everything',
    description: '官方参考实现，覆盖全部能力',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    note: '工具 / 资源 / 提示词齐全'
  }
]

function blankDraft(): ServerDraft {
  return {
    name: '',
    description: '',
    groupId: null,
    enabled: true,
    favorite: false,
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    cwd: '',
    url: '',
    headers: {}
  }
}

function toDraft(server: MCPServerConfig): ServerDraft {
  return {
    id: server.id,
    name: server.name,
    description: server.description,
    groupId: server.groupId,
    enabled: server.enabled,
    favorite: server.favorite,
    transport: server.transport,
    command: server.command,
    args: [...server.args],
    env: { ...server.env },
    cwd: server.cwd,
    url: server.url,
    headers: { ...server.headers }
  }
}

export function Editor({ mode, server }: { mode: 'create' | 'edit'; server: MCPServerConfig | null }): ReactNode {
  const { app, busy } = useStore()
  const [draft, setDraft] = useState<ServerDraft>(() => (mode === 'edit' && server ? toDraft(server) : blankDraft()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [testAfterSave, setTestAfterSave] = useState(false)

  const saving = busy['save:server'] === true

  const set = <K extends keyof ServerDraft>(key: K, value: ServerDraft[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!draft.name.trim()) next.name = '请填写名称'
    if (draft.transport === 'stdio') {
      if (!draft.command.trim()) next.command = '请填写启动命令，例如 npx'
    } else {
      if (!draft.url.trim()) next.url = '请填写服务地址'
      else {
        try {
          const parsed = new URL(draft.url)
          if (!['http:', 'https:'].includes(parsed.protocol)) next.url = '地址需以 http:// 或 https:// 开头'
        } catch {
          next.url = '地址格式不正确，需包含 http(s)://'
        }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (test: boolean): Promise<void> => {
    if (!validate()) return
    setTestAfterSave(test)
    await saveServer({ ...draft, name: draft.name.trim() }, { test })
    setTestAfterSave(false)
  }

  const applyPreset = (preset: Preset): void => {
    setDraft((current) => ({
      ...current,
      name: current.name.trim() ? current.name : preset.name,
      description: current.description.trim() ? current.description : preset.description,
      transport: 'stdio',
      command: preset.command,
      args: [...preset.args]
    }))
  }

  const cancel = (): void => {
    if (mode === 'edit' && server) {
      goTo({ mode: 'detail', serverId: server.id, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
    } else {
      goTo({ mode: 'home', serverId: null, tab: 'overview', capKind: 'tools', capItem: null, autorun: false })
    }
  }

  const groups = app?.groups ?? []

  return (
    <section className="editor">
      <header className="editor__head">
        <div className="editor__titles">
          <h2 className="editor__title">{mode === 'create' ? '新建 MCP 服务器' : `编辑「${server?.name}」`}</h2>
          <p className="editor__desc">
            {draft.transport === 'stdio'
              ? '通过本地命令启动子进程，使用标准输入输出通信。'
              : '连接远端服务，通过 HTTP 传输 JSON-RPC 消息。'}
          </p>
        </div>
        <div className="editor__actions">
          <Button size="sm" variant="ghost" onClick={cancel}>
            取消
          </Button>
          <Button size="sm" onClick={() => void submit(false)} loading={saving && !testAfterSave}>
            保存
          </Button>
          <Button size="sm" variant="primary" icon="pulse" onClick={() => void submit(true)} loading={saving && testAfterSave}>
            保存并测试
          </Button>
        </div>
      </header>

      <div className="editor__body pane-scroll">
        {mode === 'create' ? (
          <section className="presets">
            <p className="side-label">快速模板</p>
            <div className="preset-row">
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" className="preset" onClick={() => applyPreset(preset)}>
                  <span className="preset__head">
                    <Icon name="layers" size={14} />
                    <span className="preset__name">{preset.name}</span>
                  </span>
                  <span className="preset__desc">{preset.description}</span>
                  <span className="preset__cmd mono">
                    {[preset.command, ...preset.args].slice(0, 2).join(' ')} …
                  </span>
                  <span className="preset__note">{preset.note}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <header className="card__head">
            <h3 className="card__title">基本信息</h3>
          </header>
          <div className="card__body form-grid">
            <Field label="名称" required error={errors.name}>
              <Input value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="例如：文件系统" autoFocus />
            </Field>
            <Field label="分组">
              <Select value={draft.groupId ?? ''} onChange={(event) => set('groupId', event.target.value || null)}>
                <option value="">未分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="描述" hint="可选，帮助自己记住用途">
              <Input value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="例如：读写本地项目文件" />
            </Field>
            <Field label="启用">
              <div className="row-inline">
                <Switch checked={draft.enabled} onChange={(next) => set('enabled', next)} label="启用" />
                <span className="row-inline__hint">停用后不参与「全部测试」，列表中以灰色显示</span>
              </div>
            </Field>
          </div>
        </section>

        <section className="card">
          <header className="card__head">
            <h3 className="card__title">传输方式</h3>
          </header>
          <div className="card__body">
            <Segmented
              value={draft.transport}
              ariaLabel="传输方式"
              onChange={(next: TransportType) => set('transport', next)}
              options={[
                { value: 'stdio', label: 'stdio', icon: <TransportGlyph transport="stdio" size={14} /> },
                { value: 'sse', label: 'SSE', icon: <TransportGlyph transport="sse" size={14} /> },
                { value: 'http', label: 'HTTP', icon: <TransportGlyph transport="http" size={14} /> }
              ]}
            />

            {draft.transport === 'stdio' ? (
              <div className="form-stack">
                <Field label="启动命令" required error={errors.command} hint="Windows 下可直接填 npx、uvx、node、python 等">
                  <Input className="mono" value={draft.command} onChange={(event) => set('command', event.target.value)} placeholder="npx" spellCheck={false} />
                </Field>
                <Field label="命令参数" hint="每行一个参数，遵循顺序">
                  <StringListEditor value={draft.args} onChange={(next) => set('args', next)} placeholder="-y" />
                </Field>
                <div className="form-grid">
                  <Field label="工作目录" hint="可选，留空则继承应用工作目录">
                    <Input className="mono" value={draft.cwd} onChange={(event) => set('cwd', event.target.value)} placeholder="C:\\projects\\demo" spellCheck={false} />
                  </Field>
                </div>
                <Field label="环境变量" hint="会与系统环境合并，敏感值在列表中以掩码显示">
                  <KeyValueEditor value={draft.env} onChange={(next) => set('env', next)} keyPlaceholder="API_KEY" />
                </Field>
              </div>
            ) : (
              <div className="form-stack">
                <Field label="服务地址" required error={errors.url} hint="例如 https://example.com/mcp">
                  <Input className="mono" value={draft.url} onChange={(event) => set('url', event.target.value)} placeholder="https://" spellCheck={false} />
                </Field>
                <Field label="请求头" hint="用于鉴权，例如 Authorization: Bearer …">
                  <KeyValueEditor value={draft.headers} onChange={(next) => set('headers', next)} keyPlaceholder="Authorization" valuePlaceholder="Bearer …" />
                </Field>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
