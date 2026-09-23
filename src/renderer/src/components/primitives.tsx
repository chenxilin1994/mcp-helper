import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import type { ConnectionStatus } from '@shared/types'
import { Icon, type IconName } from './Icons'
import { copyText } from '../lib/clipboard'
import { isSecretKey, maskValue } from '../lib/format'
import type { ConfirmState, ContextMenuState, Toast } from '../state/store'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconRight,
  loading,
  full,
  children,
  className,
  disabled,
  ...rest
}: {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  full?: boolean
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode {
  return (
    <button
      type="button"
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', full && 'btn--full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 15} /> : null}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 14 : 15} /> : null}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  label: string
  size?: number
  variant?: 'plain' | 'soft'
  active?: boolean
}

export const IconButton = forwardRef(function IconButton(
  { icon, label, size = 28, variant = 'plain', active, className, ...rest }: IconButtonProps,
  ref: Ref<HTMLButtonElement>
): ReactNode {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('icon-btn', `icon-btn--${variant}`, active && 'is-active', className)}
      style={{ width: size, height: size }}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  )
})

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor
}: {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
}): ReactNode {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__req">必填</span> : null}
      </label>
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef(function Input(
  { className, ...rest }: InputHTMLAttributes<HTMLInputElement>,
  ref: Ref<HTMLInputElement>
): ReactNode {
  return <input ref={ref} className={cx('input', className)} {...rest} />
})

export const Textarea = forwardRef(function Textarea(
  { className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>,
  ref: Ref<HTMLTextAreaElement>
): ReactNode {
  return <textarea ref={ref} className={cx('input', 'textarea', className)} {...rest} />
})

export const Select = forwardRef(function Select(
  { className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>,
  ref: Ref<HTMLSelectElement>
): ReactNode {
  return (
    <div className="select-wrap">
      <select ref={ref} className={cx('input', 'select', className)} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} className="select__caret" />
    </div>
  )
})

export function Switch({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx('switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__thumb" />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel
}: {
  value: T
  options: Array<{ value: T; label: ReactNode; icon?: IconName | ReactNode; count?: number }>
  onChange: (next: T) => void
  size?: 'md' | 'sm'
  ariaLabel?: string
}): ReactNode {
  return (
    <div className={cx('segmented', size === 'sm' && 'segmented--sm')} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={cx('segmented__item', option.value === value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.icon
            ? typeof option.icon === 'string'
              ? <Icon name={option.icon as IconName} size={14} />
              : option.icon
            : null}
          <span>{option.label}</span>
          {typeof option.count === 'number' ? <span className="segmented__count tnum">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  mono,
  icon
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'ok' | 'err' | 'warn'
  mono?: boolean
  icon?: IconName
}): ReactNode {
  return (
    <span className={cx('badge', `badge--${tone}`, mono && 'badge--mono')}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

export function StatusDot({
  status,
  size = 8,
  pulse
}: {
  status: ConnectionStatus | 'idle'
  size?: number
  pulse?: boolean
}): ReactNode {
  const tone =
    status === 'ready' ? 'ok' : status === 'error' ? 'err' : status === 'connecting' ? 'warn' : 'idle'
  return (
    <span
      className={cx('status-dot', `status-dot--${tone}`, pulse && 'status-dot--pulse')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {pulse ? <span className="status-dot__ring" /> : null}
    </span>
  )
}

export type MenuItem =
  | { separator: true; label?: never; onSelect?: never }
  | {
      separator?: false
      label: string
      icon?: IconName
      onSelect: () => void
      danger?: boolean
      disabled?: boolean
      hint?: string
    }

export function MenuButton({
  icon = 'kebab',
  label = '更多操作',
  items,
  size = 26,
  className
}: {
  icon?: IconName
  label?: string
  items: MenuItem[]
  size?: number
  className?: string
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.max(196, menuRef.current?.offsetWidth ?? 196)
    const height = menuRef.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    let top = rect.bottom + 6
    if (height && top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6)
    setPos({ left, top, minWidth: width })
  }, [])

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    const reposition = (): void => updatePosition()
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('scroll', reposition, true)
    }
  }, [open, updatePosition])

  return (
    <>
      <IconButton
        ref={anchorRef}
        icon={icon}
        label={label}
        size={size}
        className={cx(open && 'is-active', className)}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      />
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="menu"
              role="menu"
              style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: pos?.minWidth, visibility: pos ? 'visible' : 'hidden' }}
            >
              {items.map((item, index) =>
                item.separator ? (
                  <div key={`sep-${index}`} className="menu__sep" />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={cx('menu__item', item.danger && 'menu__item--danger')}
                    disabled={item.disabled}
                    onClick={(event) => {
                      event.stopPropagation()
                      setOpen(false)
                      item.onSelect()
                    }}
                  >
                    {item.icon ? <Icon name={item.icon} size={15} /> : null}
                    <span className="menu__label">{item.label}</span>
                    {item.hint ? <span className="menu__hint mono">{item.hint}</span> : null}
                  </button>
                )
              )}            </div>,
            document.body
          )
        : null}
    </>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}): ReactNode {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onCancel = (event: Event): void => {
      event.preventDefault()
      onClose()
    }
    element.addEventListener('cancel', onCancel)
    return () => element.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      style={{ width }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog__panel">
        <header className="dialog__head">
          <div className="dialog__titles">
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="dialog__desc">{description}</p> : null}
          </div>
          <IconButton icon="x" label="关闭" onClick={onClose} />
        </header>
        <div className="dialog__body">{children}</div>
        {footer ? <footer className="dialog__foot">{footer}</footer> : null}
      </div>
    </dialog>
  )
}

export function ConfirmHost({ confirm, onResolve, onDismiss }: { confirm: ConfirmState | null; onResolve: () => void; onDismiss: () => void }): ReactNode {
  if (!confirm) return null
  return (
    <Dialog
      open={Boolean(confirm)}
      onClose={onDismiss}
      title={confirm.title}
      description={confirm.message}
      width={420}
      footer={
        <>
          <Button onClick={onDismiss}>取消</Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={onResolve}>
            {confirm.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-body" />
    </Dialog>
  )
}

export function ToastHost({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }): ReactNode {
  if (!toasts.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('toast', `toast--${toast.kind}`)}>
          <Icon
            name={toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info'}
            size={16}
            className="toast__icon"
          />
          <div className="toast__text">
            <p className="toast__title">{toast.title}</p>
            {toast.message ? <p className="toast__message">{toast.message}</p> : null}
            {toast.action ? (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  onDismiss(toast.id)
                  toast.action?.onAction()
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
          <IconButton icon="x" label="关闭提示" size={22} onClick={() => onDismiss(toast.id)} />
        </div>
      ))}
    </div>
  )
}

export function ContextMenuHost({ menu, onClose }: { menu: ContextMenuState | null; onClose: () => void }): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu) {
      setPos(null)
      return
    }
    const width = ref.current?.offsetWidth ?? 200
    const height = ref.current?.offsetHeight ?? 0
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onClose)
    document.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onClose)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [menu, onClose])

  if (!menu) return null

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
    >
      {menu.items.map((item, index) =>
        item.separator ? (
          <div key={`sep-${index}`} className="menu__sep" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={cx('menu__item', item.danger && 'menu__item--danger')}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.icon ? <Icon name={item.icon} size={15} /> : null}
            <span className="menu__label">{item.label}</span>
            {item.hint ? <span className="menu__hint mono">{item.hint}</span> : null}
          </button>
        )
      )}
    </div>,
    document.body
  )
}

export function EmptyState({
  icon,
  title,
  description,
  children,
  compact
}: {
  icon: IconName
  title: string
  description?: ReactNode
  children?: ReactNode
  compact?: boolean
}): ReactNode {
  return (
    <div className={cx('empty', compact && 'empty--compact')}>
      <div className="empty__icon">
        <Icon name={icon} size={compact ? 18 : 22} />
      </div>
      <h3 className="empty__title">{title}</h3>
      {description ? <div className="empty__desc">{description}</div> : null}
      {children ? <div className="empty__actions">{children}</div> : null}
    </div>
  )
}

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = '名称',
  valuePlaceholder = '值',
  addLabel = '添加一项',
  emptyHint
}: {
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
  emptyHint?: string
}): ReactNode {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const entries = Object.entries(value)

  const renameKey = (oldKey: string, newKey: string): void => {
    const next: Record<string, string> = {}
    for (const [key, val] of entries) {
      if (key === oldKey) next[newKey] = val
      else next[key] = val
    }
    onChange(next)
  }

  const setValue = (key: string, val: string): void => {
    onChange({ ...value, [key]: val })
  }

  const remove = (key: string): void => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  const add = (): void => {
    let name = ''
    let index = 1
    while (name === '' || name in value) {
      name = `NEW_VAR_${index}`
      index += 1
    }
    onChange({ ...value, [name]: '' })
  }

  return (
    <div className="kv">
      {entries.length === 0 && emptyHint ? <p className="kv__empty">{emptyHint}</p> : null}
      {entries.map(([key, val], index) => {
        const secret = isSecretKey(key)
        const show = revealed[key] === true
        return (
          <div className="kv__row" key={index}>
            <Input
              className="kv__key mono"
              value={key}
              spellCheck={false}
              onChange={(event) => renameKey(key, event.target.value)}
              placeholder={keyPlaceholder}
            />
            {secret && !show ? (
              <Input className="kv__value mono" value={maskValue(val)} readOnly onFocus={() => setRevealed((state) => ({ ...state, [key]: true }))} />
            ) : (
              <Input
                className="kv__value mono"
                value={val}
                spellCheck={false}
                onChange={(event) => setValue(key, event.target.value)}
                placeholder={valuePlaceholder}
              />
            )}
            {secret ? (
              <IconButton
                icon={show ? 'eyeOff' : 'eye'}
                label={show ? '隐藏值' : '显示值'}
                size={26}
                onClick={() => setRevealed((state) => ({ ...state, [key]: !show }))}
              />
            ) : null}
            <IconButton icon="trash" label="删除" size={26} onClick={() => remove(key)} />
          </div>
        )
      })}
      <Button size="sm" icon="plus" onClick={add} className="kv__add">
        {addLabel}
      </Button>
    </div>
  )
}

export function StringListEditor({
  value,
  onChange,
  placeholder,
  addLabel = '添加参数'
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  addLabel?: string
}): ReactNode {
  const rows = value.length ? value : []
  return (
    <div className="kv">
      {rows.map((item, index) => (
        <div className="kv__row" key={index}>
          <Input
            className="kv__value mono"
            value={item}
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => {
              const next = [...value]
              next[index] = event.target.value
              onChange(next)
            }}
          />
          <IconButton
            icon="trash"
            label="删除参数"
            size={26}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          />
        </div>
      ))}
      <Button size="sm" icon="plus" onClick={() => onChange([...value, ''])} className="kv__add">
        {addLabel}
      </Button>
    </div>
  )
}

export function CopyButton({
  text,
  label = '复制',
  size = 28,
  variant = 'plain',
  onCopied
}: {
  text: string
  label?: string
  size?: number
  variant?: 'plain' | 'soft'
  onCopied?: (ok: boolean) => void
}): ReactNode {
  const [copied, setCopied] = useState(false)
  return (
    <IconButton
      icon={copied ? 'check' : 'copy'}
      label={copied ? '已复制' : label}
      size={size}
      variant={variant}
      className={copied ? 'is-copied' : undefined}
      onClick={async () => {
        const ok = await copyText(text)
        onCopied?.(ok)
        if (ok) {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        }
      }}
    />
  )
}

export function Skeleton({ width = '100%', height = 14, radius = 6 }: { width?: number | string; height?: number; radius?: number }): ReactNode {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} />
}
