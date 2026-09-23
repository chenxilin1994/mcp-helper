import { useEffect, useState, type ReactNode } from 'react'
import { Button, Dialog, Field, Input, Segmented, cx } from './primitives'
import { GROUP_COLOR_NAMES, groupColor } from '../lib/format'
import { closeDialog, closeGroupEditor, saveSettings, submitGroup } from '../state/actions'
import { useStore } from '../state/store'

export function SettingsDialog(): ReactNode {
  const { dialog, app } = useStore()
  const settings = app?.settings
  const [connectTimeout, setConnectTimeout] = useState('30000')
  const [callTimeout, setCallTimeout] = useState('60000')
  const [dataFile, setDataFile] = useState('')

  useEffect(() => {
    if (!settings) return
    setConnectTimeout(String(settings.connectTimeoutMs))
    setCallTimeout(String(settings.callTimeoutMs))
  }, [settings?.connectTimeoutMs, settings?.callTimeoutMs])

  useEffect(() => {
    if (dialog !== 'settings') return
    window.api.dataFile().then(setDataFile).catch(() => setDataFile(''))
  }, [dialog])

  const commitTimeout = (value: string, key: 'connectTimeoutMs' | 'callTimeoutMs'): void => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(600_000, Math.max(1_000, Math.round(parsed)))
    void saveSettings({ [key]: clamped })
    if (key === 'connectTimeoutMs') setConnectTimeout(String(clamped))
    else setCallTimeout(String(clamped))
  }

  return (
    <Dialog open={dialog === 'settings'} onClose={closeDialog} title="设置" width={560}>
      <div className="settings">
        <Field label="主题">
          <Segmented
            value={settings?.theme ?? 'system'}
            ariaLabel="主题"
            onChange={(next) => void saveSettings({ theme: next })}
            options={[
              { value: 'system', label: '跟随系统', icon: 'monitor' },
              { value: 'dark', label: '深色', icon: 'moon' },
              { value: 'light', label: '浅色', icon: 'sun' }
            ]}
          />
        </Field>

        <div className="settings__row">
          <Field label="连接超时" hint="initialize 握手最长等待时间">
            <div className="input-suffix">
              <Input
                className="mono tnum"
                type="number"
                min={1000}
                max={600000}
                step={1000}
                value={connectTimeout}
                onChange={(event) => setConnectTimeout(event.target.value)}
                onBlur={() => commitTimeout(connectTimeout, 'connectTimeoutMs')}
              />
              <span>ms</span>
            </div>
          </Field>
          <Field label="调用超时" hint="工具调用与资源读取的超时">
            <div className="input-suffix">
              <Input
                className="mono tnum"
                type="number"
                min={1000}
                max={600000}
                step={1000}
                value={callTimeout}
                onChange={(event) => setCallTimeout(event.target.value)}
                onBlur={() => commitTimeout(callTimeout, 'callTimeoutMs')}
              />
              <span>ms</span>
            </div>
          </Field>
        </div>

        <Field label="数据文件" hint="所有 MCP 配置与测试记录保存在此处，写入前会自动生成 .bak 备份">
          <Input className="mono" value={dataFile} readOnly spellCheck={false} />
        </Field>

        <div className="settings__about">
          <p className="settings__about-title">MCP Helper v0.1.0</p>
          <p className="settings__about-text">
            基于 Model Context Protocol 官方 SDK，支持 stdio / SSE / Streamable HTTP 三种传输。
          </p>
        </div>
      </div>
    </Dialog>
  )
}

export function GroupEditorDialog(): ReactNode {
  const { groupEditor } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState('blue')

  useEffect(() => {
    setName(groupEditor?.name ?? '')
    setColor(groupEditor?.color ?? 'blue')
  }, [groupEditor])

  return (
    <Dialog
      open={Boolean(groupEditor)}
      onClose={closeGroupEditor}
      title={groupEditor?.id ? '重命名分组' : '新建分组'}
      width={420}
      footer={
        <>
          <Button onClick={closeGroupEditor}>取消</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => void submitGroup({ id: groupEditor?.id, name: name.trim(), color })}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="settings">
        <Field label="分组名称">
          <Input
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：办公 / 开发 / 研究"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) void submitGroup({ id: groupEditor?.id, name: name.trim(), color })
            }}
          />
        </Field>
        <Field label="标记颜色">
          <div className="swatches">
            {GROUP_COLOR_NAMES.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`颜色 ${item}`}
                aria-pressed={color === item}
                className={cx('swatch', color === item && 'is-active')}
                style={{ background: groupColor(item) }}
                onClick={() => setColor(item)}
              />
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}
