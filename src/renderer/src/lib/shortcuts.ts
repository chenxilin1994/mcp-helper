import { DEFAULT_SHORTCUTS, type ShortcutAction } from '@shared/shortcuts'

const IGNORED_KEYS = new Set([
  'Control',
  'Alt',
  'Shift',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Dead',
  'Unidentified',
  'ContextMenu',
  'Process'
])

const NAMED_KEYS = new Set([
  'Enter',
  'Escape',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
])

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: '空格',
  Escape: 'Esc',
  Delete: 'Del',
  PageUp: 'PgUp',
  PageDown: 'PgDn'
}

function normalizeKey(event: KeyboardEvent): string | null {
  const key = event.key
  if (!key || IGNORED_KEYS.has(key)) return null
  if (key === ' ' || key === 'Spacebar') return 'Space'
  if (NAMED_KEYS.has(key)) return key
  if (/^F\d{1,2}$/.test(key)) return key
  if (key.length === 1) return key.toUpperCase()
  return null
}

export function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const key = normalizeKey(event)
  if (!key) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const isFunctionKey = /^F\d{1,2}$/.test(key)
  if (!parts.length && !isFunctionKey) return null
  parts.push(key)
  return parts.join('+')
}

export function shortcutKeys(accelerator: string): string[] {
  if (!accelerator) return []
  return accelerator.split('+').map((part) => KEY_LABELS[part] ?? part)
}

export function resolveShortcut(
  action: ShortcutAction,
  shortcuts: Partial<Record<ShortcutAction, string>> | undefined
): string {
  const value = shortcuts?.[action]
  return value === undefined ? DEFAULT_SHORTCUTS[action] : value
}

export function findActionForEvent(
  event: KeyboardEvent,
  shortcuts: Partial<Record<ShortcutAction, string>> | undefined
): ShortcutAction | null {
  const accelerator = acceleratorFromEvent(event)
  if (!accelerator) return null
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const binding = resolveShortcut(action, shortcuts)
    if (binding && binding === accelerator) return action
  }
  return null
}

export function findConflicts(
  shortcuts: Partial<Record<ShortcutAction, string>>
): Partial<Record<ShortcutAction, ShortcutAction>> {
  const byAccelerator = new Map<string, ShortcutAction>()
  const conflicts: Partial<Record<ShortcutAction, ShortcutAction>> = {}
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const binding = resolveShortcut(action, shortcuts)
    if (!binding) continue
    const existing = byAccelerator.get(binding)
    if (existing) {
      conflicts[action] = existing
      conflicts[existing] = action
    } else {
      byAccelerator.set(binding, action)
    }
  }
  return conflicts
}
