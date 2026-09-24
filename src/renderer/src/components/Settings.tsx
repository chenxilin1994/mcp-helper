import { useEffect, useState, type ReactNode } from 'react'
import {
  FONT_SCALES,
  MONO_FONTS,
  SHORTCUT_ACTIONS,
  THEME_PALETTES,
  UI_FONTS,
  ZOOM_LEVELS,
  type ShortcutAction
} from '@shared/shortcuts'
import type { Settings } from '@shared/types'
import { Badge, Button, Dialog, Field, IconButton, Input, Segmented, Select, cx } from './primitives'
import { GROUP_COLOR_NAMES, groupColor } from '../lib/format'
import { acceleratorFromEvent, findConflicts, resolveShortcut, shortcutKeys } from '../lib/shortcuts'
import { closeDialog, closeGroupEditor, saveSettings, setZoom, submitGroup } from '../state/actions'
import { pushToast, useStore } from '../state/store'

type SettingsTab = 'appearance' | 'shortcuts' | 'advanced'

export function SettingsDialog(): ReactNode {
  const { dialog, app } = useStore()
  const settings = app?.settings
  const [tab, setTab] = useState<SettingsTab>('appearance')

  return (
    <Dialog open={dialog === 'settings'} onClose={closeDialog} title="设置" width={640}>
      <Segmented
        value={tab}
        ariaLabel="设置分类"
        onChange={setTab}
        options={[
          { value: 'appearance', label: '外观', icon: 'sun' },
          { value: 'shortcuts', label: '快捷键', icon: 'zap' },
          { value: 'advanced', label: '高级', icon: 'settings' }
        ]}
      />
      <div className="settings-tab">
        {tab === 'appearance' && settings ? <AppearancePane settings={settings} /> : null}
        {tab === 'shortcuts' && settings ? <ShortcutsPane settings={settings} /> : null}
        {tab === 'advanced' && settings ? <AdvancedPane settings={settings} /> : null}
      </div>
    </Dialog>
  )
}

function AppearancePane({ settings }: { settings: Settings }): ReactNode {
  return (
    <div className="settings">
      <Field label="主题模式">
        <Segmented
          value={settings.theme}
          ariaLabel="主题模式"
          onChange={(next) => void saveSettings({ theme: next })}
          options={[
            { value: 'system', label: '跟随系统', icon: 'monitor' },
            { value: 'dark', label: '深色', icon: 'moon' },
            { value: 'light', label: '浅色', icon: 'sun' }
          ]}
        />
      </Field>

      <Field label="配色方案" hint="状态色（连通绿 / 故障红 / 探测橙）在所有配色下保持一致语义">
        <div className="palette-grid">
          {THEME_PALETTES.map((palette) => (
            <button
              key={palette.value}
              type="button"
              className={cx('palette-card', settings.palette === palette.value && 'is-active')}
              aria-pressed={settings.palette === palette.value}
              onClick={() => void saveSettings({ palette: palette.value })}
            >
              <span className="palette-card__dot" style={{ background: palette.color }} />
              <span className="palette-card__text">
                <span className="palette-card__name">{palette.label}</span>
                <span className="palette-card__hint">{palette.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Field>

      <div className="settings__row">
        <Field label="界面字体">
          <Select value={settings.uiFont} onChange={(event) => void saveSettings({ uiFont: event.target.value as Settings['uiFont'] })}>
            {UI_FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="代码字体" hint="用于命令、地址、JSON 与日志">
          <Select
            value={settings.monoFont}
            onChange={(event) => void saveSettings({ monoFont: event.target.value as Settings['monoFont'] })}
          >
            {MONO_FONTS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="界面字号" hint="只缩放文字，不影响布局密度">
        <Segmented
          value={String(settings.fontScale)}
          ariaLabel="界面字号"
          onChange={(next) => void saveSettings({ fontScale: Number(next) })}
          options={FONT_SCALES.map((scale) => ({ value: String(scale.value), label: scale.label }))}
        />
      </Field>

      <Field label="页面缩放" hint="整体缩放界面（含间距与控件），也可用快捷键调整">
        <div className="settings__zoom">
          <Segmented
            value={String(settings.zoom)}
            ariaLabel="页面缩放"
            onChange={(next) => void setZoom(Number(next))}
            options={ZOOM_LEVELS.map((level) => ({ value: String(level.value), label: level.label }))}
          />
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => void setZoom(1)}>
            恢复 100%
          </Button>
        </div>
      </Field>
    </div>
  )
}

function ShortcutsPane({ settings }: { settings: Settings }): ReactNode {
  const conflicts = findConflicts(settings.shortcuts)
  const groups = Array.from(new Set(SHORTCUT_ACTIONS.map((action) => action.group)))

  const labelOf = (action: ShortcutAction): string =>
    SHORTCUT_ACTIONS.find((item) => item.id === action)?.label ?? action

  const update = (action: ShortcutAction, accelerator: string | null): void => {
    const next = { ...settings.shortcuts }
    if (accelerator === null) delete next[action]
    else next[action] = accelerator
    if (accelerator) {
      const nextConflicts = findConflicts(next)
      if (nextConflicts[action]) {
        pushToast({
          kind: 'error',
          title: '快捷键冲突',
          message: `该组合已被「${labelOf(nextConflicts[action] as ShortcutAction)}」使用`
        })
        return
      }
    }
    void saveSettings({ shortcuts: next })
  }

  const resetAll = (): void => {
    void saveSettings({ shortcuts: {} })
    pushToast({ kind: 'success', title: '已恢复默认快捷键' })
  }

  return (
    <div className="settings">
      <p className="settings__hint">
        点击组合键后按下新按键即可重新绑定，按 <kbd>Esc</kbd> 取消。带 <kbd>Ctrl</kbd> 或 <kbd>Alt</kbd> 的组合在输入框内同样生效；
        清空后该功能不再绑定快捷键。
      </p>

      {groups.map((group) => (
        <section className="sc-group" key={group}>
          <p className="side-label">{group}</p>
          {SHORTCUT_ACTIONS.filter((action) => action.group === group).map((action) => (
            <ShortcutRow
              key={action.id}
              action={action.id}
              label={action.label}
              value={resolveShortcut(action.id, settings.shortcuts)}
              isDefault={settings.shortcuts[action.id] === undefined}
              conflict={conflicts[action.id]}
              conflictLabel={conflicts[action.id] ? labelOf(conflicts[action.id] as ShortcutAction) : undefined}
              onRecord={(accelerator) => update(action.id, accelerator)}
              onClear={() => update(action.id, '')}
              onReset={() => update(action.id, null)}
            />
          ))}
        </section>
      ))}

      <div className="sc-foot">
        <Button size="sm" icon="refresh" onClick={resetAll}>
          全部恢复默认
        </Button>
      </div>
    </div>
  )
}

function ShortcutRow({
  label,
  value,
  isDefault,
  conflict,
  conflictLabel,
  onRecord,
  onClear,
  onReset
}: {
  action: ShortcutAction
  label: string
  value: string
  isDefault: boolean
  conflict?: ShortcutAction
  conflictLabel?: string
  onRecord: (accelerator: string) => void
  onClear: () => void
  onReset: () => void
}): ReactNode {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const accelerator = acceleratorFromEvent(event)
      if (!accelerator) return
      setRecording(false)
      onRecord(accelerator)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onRecord])

  return (
    <div className={cx('sc-row', conflict && 'is-conflict')}>
      <span className="sc-row__label">{label}</span>
      <button
        type="button"
        className={cx('sc-row__keys', recording && 'is-recording', !value && 'is-empty')}
        onClick={() => setRecording(true)}
        title={recording ? '按下新的组合键' : '点击重新录制'}
      >
        {recording ? (
          <span className="sc-row__recording">按下组合键…</span>
        ) : value ? (
          shortcutKeys(value).map((key, index) => (
            <kbd key={`${key}-${index}`} className="kbd">
              {key}
            </kbd>
          ))
        ) : (
          <span className="sc-row__none">未设置</span>
        )}
      </button>
      {conflict ? <span className="sc-row__conflict">与「{conflictLabel}」重复</span> : null}
      <span className="sc-row__actions">
        <IconButton icon="x" label="清除快捷键" size={24} onClick={onClear} disabled={!value} />
        <IconButton icon="refresh" label="恢复默认" size={24} onClick={onReset} disabled={isDefault} />
      </span>
    </div>
  )
}

function AdvancedPane({ settings }: { settings: Settings }): ReactNode {
  const [connectTimeout, setConnectTimeout] = useState(String(settings.connectTimeoutMs))
  const [callTimeout, setCallTimeout] = useState(String(settings.callTimeoutMs))
  const [dataFile, setDataFile] = useState('')

  useEffect(() => {
    setConnectTimeout(String(settings.connectTimeoutMs))
    setCallTimeout(String(settings.callTimeoutMs))
  }, [settings.connectTimeoutMs, settings.callTimeoutMs])

  useEffect(() => {
    window.api.dataFile().then(setDataFile).catch(() => setDataFile(''))
  }, [])

  const commitTimeout = (value: string, key: 'connectTimeoutMs' | 'callTimeoutMs'): void => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(600_000, Math.max(1_000, Math.round(parsed)))
    void saveSettings({ [key]: clamped })
    if (key === 'connectTimeoutMs') setConnectTimeout(String(clamped))
    else setCallTimeout(String(clamped))
  }

  return (
    <div className="settings">
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
        <p className="settings__about-title">MCP Helper v{__APP_VERSION__}</p>
        <p className="settings__about-text">
          基于 Model Context Protocol 官方 SDK，支持 stdio / SSE / Streamable HTTP 三种传输。
        </p>
      </div>
    </div>
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
