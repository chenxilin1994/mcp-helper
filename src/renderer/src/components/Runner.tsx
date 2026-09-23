import { useMemo, useState, type ReactNode } from 'react'
import type { ContentBlock, MCPServerConfig } from '@shared/types'
import { JsonBlock, stringifyJson } from '../lib/json'
import { formatLatency, formatTime } from '../lib/format'
import { fieldsFromPromptArguments, fieldsFromSchema, initialValues, missingRequired, toArguments, type SchemaField } from '../lib/schema'
import { Badge, Button, CopyButton, Field, Input, Select, Switch, Textarea, cx } from './primitives'
import type { RunResult } from '../state/store'

function isErrorRun(run: RunResult): boolean {
  if (run.kind === 'tool') return run.result.isError
  return false
}

function rawOf(run: RunResult): unknown {
  return run.result.raw
}

function ContentBlocks({ blocks }: { blocks: ContentBlock[] }): ReactNode {
  if (!blocks.length) return <p className="result__empty">返回内容为空</p>
  return (
    <div className="blocks">
      {blocks.map((block, index) => (
        <ContentBlockView key={index} block={block} />
      ))}
    </div>
  )
}

function ContentBlockView({ block }: { block: ContentBlock }): ReactNode {
  if (block.type === 'text') {
    const text = (block as { text: string }).text ?? ''
    return (
      <div className="block block--text">
        <div className="block__head">
          <span className="block__kind mono">text</span>
          <CopyButton text={text} label="复制文本" size={24} />
        </div>
        <pre className="code-block code-block--plain">{text}</pre>
      </div>
    )
  }

  if (block.type === 'image') {
    const image = block as { data: string; mimeType: string }
    return (
      <div className="block block--image">
        <div className="block__head">
          <span className="block__kind mono">{image.mimeType}</span>
          <span className="block__size tnum">{Math.round((image.data.length * 0.75) / 1024)} KB</span>
        </div>
        <img className="result__image" src={`data:${image.mimeType};base64,${image.data}`} alt="工具返回的图片" />
      </div>
    )
  }

  if (block.type === 'audio') {
    const audio = block as { data: string; mimeType: string }
    return (
      <div className="block">
        <div className="block__head">
          <span className="block__kind mono">{audio.mimeType}</span>
        </div>
        <audio controls src={`data:${audio.mimeType};base64,${audio.data}`} />
      </div>
    )
  }

  if (block.type === 'resource') {
    const resource = (block as { resource?: { uri?: string; mimeType?: string; text?: string } }).resource ?? {}
    return (
      <div className="block block--resource">
        <div className="block__head">
          <span className="block__kind mono">resource</span>
          {resource.mimeType ? <span className="block__size mono">{resource.mimeType}</span> : null}
        </div>
        <p className="block__uri mono">{resource.uri}</p>
        {resource.text ? <pre className="code-block code-block--plain">{resource.text}</pre> : null}
      </div>
    )
  }

  return (
    <div className="block">
      <div className="block__head">
        <span className="block__kind mono">{block.type}</span>
      </div>
      <JsonBlock value={block} maxHeight={260} />
    </div>
  )
}

export function ResultView({ run }: { run: RunResult }): ReactNode {
  const error = isErrorRun(run)
  const method =
    run.kind === 'tool' ? `tools/call ${run.name}` : run.kind === 'resource' ? `resources/read ${run.uri}` : `prompts/get ${run.name}`

  return (
    <section className={cx('result', error && 'result--error')}>
      <header className="result__head">
        <div className="readout readout--tight">
          <div className="readout__cell">
            <span className="readout__label">结果</span>
            <span className="readout__value">
              <Badge tone={error ? 'err' : 'ok'} icon={error ? 'alert' : 'check'}>
                {error ? '返回错误' : '成功'}
              </Badge>
            </span>
          </div>
          <div className="readout__cell">
            <span className="readout__label">方法</span>
            <span className="readout__value mono">{method}</span>
          </div>
          <div className="readout__cell">
            <span className="readout__label">耗时</span>
            <span className="readout__value mono tnum">{formatLatency(run.result.latencyMs)}</span>
          </div>
          <div className="readout__cell">
            <span className="readout__label">时间</span>
            <span className="readout__value mono tnum">{formatTime(run.at)}</span>
          </div>
        </div>
        <CopyButton text={stringifyJson(rawOf(run))} label="复制原始 JSON" size={26} />
      </header>

      <div className="result__body">
        {run.kind === 'tool' ? <ContentBlocks blocks={run.result.content} /> : null}

        {run.kind === 'resource'
          ? run.result.contents.map((content, index) => (
              <div className="block" key={index}>
                <div className="block__head">
                  <span className="block__kind mono">{content.mimeType ?? 'resource'}</span>
                  <span className="block__uri mono">{content.uri}</span>
                  {content.text ? <CopyButton text={content.text} label="复制内容" size={24} /> : null}
                </div>
                {content.text ? (
                  <pre className="code-block code-block--plain">{content.text}</pre>
                ) : (
                  <p className="result__empty">二进制内容 {content.blob ? `(${content.blob.length} 字符 base64)` : ''}</p>
                )}
              </div>
            ))
          : null}

        {run.kind === 'prompt'
          ? run.result.messages.map((message, index) => (
              <div className="block" key={index}>
                <div className="block__head">
                  <span className={cx('role-chip', `role-chip--${message.role}`)}>{message.role}</span>
                </div>
                <ContentBlocks blocks={[message.content]} />
              </div>
            ))
          : null}

        {run.kind === 'tool' && run.result.structuredContent !== undefined ? (
          <section className="result__section">
            <h4 className="result__section-title">结构化输出</h4>
            <JsonBlock value={run.result.structuredContent} maxHeight={320} />
          </section>
        ) : null}

        <details className="result__raw">
          <summary>原始 JSON-RPC 响应</summary>
          <JsonBlock value={rawOf(run)} maxHeight={360} />
        </details>
      </div>
    </section>
  )
}

export function Runner({
  server,
  kind,
  name,
  fields,
  onRun,
  running
}: {
  server: MCPServerConfig
  kind: 'tool' | 'prompt'
  name: string
  fields: SchemaField[]
  onRun: (args: Record<string, unknown>) => void
  running: boolean
}): ReactNode {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(fields))
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState<string>(() => stringifyJson(toArguments(fields, initialValues(fields))))
  const [jsonError, setJsonError] = useState<string | undefined>()
  const [missing, setMissing] = useState<string[]>([])
  const [showArgs, setShowArgs] = useState(false)

  const argsPreview = useMemo(() => stringifyJson(toArguments(fields, values)), [fields, values])

  const setValue = (fieldName: string, value: unknown): void => {
    setValues((current) => ({ ...current, [fieldName]: value }))
  }

  const switchMode = (next: 'form' | 'json'): void => {
    if (next === mode) return
    if (next === 'json') {
      setJsonText(argsPreview)
      setJsonError(undefined)
      setMode('json')
      return
    }
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('参数必须是 JSON 对象')
      const nextValues = { ...values }
      for (const key of Object.keys(parsed)) nextValues[key] = parsed[key]
      setValues(nextValues)
      setJsonError(undefined)
      setMode('form')
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error))
    }
  }

  const submit = (): void => {
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonText || '{}') as Record<string, unknown>
        onRun(parsed ?? {})
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : String(error))
      }
      return
    }
    const missingFields = missingRequired(fields, values)
    setMissing(missingFields)
    if (missingFields.length) return
    onRun(toArguments(fields, values))
  }

  return (
    <div className="runner">
      <div className="runner__head">
        <span className="runner__title">
          {kind === 'tool' ? '调用测试' : '获取提示词'}
        </span>
        <div className="runner__modes">
          <button type="button" className={cx('link-tab', mode === 'form' && 'is-active')} onClick={() => switchMode('form')}>
            表单
          </button>
          <button type="button" className={cx('link-tab', mode === 'json' && 'is-active')} onClick={() => switchMode('json')}>
            原始 JSON
          </button>
        </div>
      </div>

      {mode === 'form' ? (
        <div className="runner__fields">
          {fields.length === 0 ? (
            <p className="runner__hint">该{kind === 'tool' ? '工具' : '提示词'}不需要参数，直接运行即可。</p>
          ) : (
            fields.map((field) => (
              <Field
                key={field.name}
                label={field.label}
                required={field.required}
                hint={field.description}
                error={missing.includes(field.label) ? '此项为必填' : undefined}
              >
                {field.kind === 'boolean' ? (
                  <div className="runner__switch">
                    <Switch checked={values[field.name] === true} onChange={(next) => setValue(field.name, next)} label={field.label} />
                    <span className="runner__switch-label">{values[field.name] === true ? 'true' : 'false'}</span>
                  </div>
                ) : field.kind === 'enum' ? (
                  <Select value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)}>
                    <option value="">— 选择 —</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : field.kind === 'number' ? (
                  <Input
                    type="number"
                    className="mono"
                    value={String(values[field.name] ?? '')}
                    onChange={(event) => setValue(field.name, event.target.value)}
                  />
                ) : field.kind === 'string-list' || field.kind === 'json' ? (
                  <Textarea
                    className="mono"
                    rows={3}
                    value={String(values[field.name] ?? '')}
                    placeholder={field.kind === 'json' ? '{ }' : field.placeholder}
                    onChange={(event) => setValue(field.name, event.target.value)}
                  />
                ) : (
                  <Input
                    value={String(values[field.name] ?? '')}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    spellCheck={false}
                  />
                )}
              </Field>
            ))
          )}

          <details className="runner__preview" open={showArgs} onToggle={(event) => setShowArgs((event.target as HTMLDetailsElement).open)}>
            <summary>将发送的参数</summary>
            <JsonBlock value={toArguments(fields, values)} maxHeight={200} />
          </details>
        </div>
      ) : (
        <div className="runner__json">
          <Textarea
            className="mono"
            rows={8}
            value={jsonText}
            spellCheck={false}
            onChange={(event) => {
              setJsonText(event.target.value)
              setJsonError(undefined)
            }}
          />
          {jsonError ? <p className="field__error">JSON 无效：{jsonError}</p> : null}
        </div>
      )}

      <div className="runner__foot">
        <Button variant="primary" size="sm" icon="play" loading={running} onClick={submit}>
          {kind === 'tool' ? '运行' : '获取'}
        </Button>
        <span className="runner__server mono">{server.name}</span>
      </div>
    </div>
  )
}

export function capabilityFields(tool: {
  inputSchema?: unknown
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}): SchemaField[] {
  if (tool.arguments) return fieldsFromPromptArguments(tool.arguments)
  return fieldsFromSchema(tool.inputSchema)
}
