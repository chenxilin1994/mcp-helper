import type { CapKind, DialogId, TabId, ViewState } from './store'

export interface Route {
  view: ViewState
  dialog: DialogId
}

const TAB_IDS: TabId[] = ['overview', 'caps', 'logs', 'json']
const CAP_KINDS: CapKind[] = ['tools', 'resources', 'prompts']

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = raw.split('?')
  const params = new URLSearchParams(queryPart ?? '')
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent)

  const base: ViewState = {
    mode: 'home',
    serverId: null,
    tab: 'overview',
    capKind: 'tools',
    capItem: null,
    autorun: false
  }

  if (segments[0] === 'new') {
    return { view: { ...base, mode: 'create' }, dialog: null }
  }

  if (segments[0] === 'import') {
    return { view: base, dialog: 'import' }
  }

  if (segments[0] === 'settings') {
    return { view: base, dialog: 'settings' }
  }

  if (segments[0] === 's' && segments[1]) {
    const tail = segments[2]
    const view: ViewState = { ...base, mode: 'detail', serverId: segments[1] }
    if (tail === 'edit') {
      view.mode = 'edit'
    } else if (tail && TAB_IDS.includes(tail as TabId)) {
      view.tab = tail as TabId
      const kind = params.get('kind')
      if (kind && CAP_KINDS.includes(kind as CapKind)) view.capKind = kind as CapKind
      view.capItem = params.get('item')
      view.autorun = params.get('run') === '1'
    }
    return { view, dialog: null }
  }

  return { view: base, dialog: null }
}

export function hashFor(view: ViewState): string {
  if (view.mode === 'create') return '#/new'
  if (view.mode === 'home') return '#/'
  const base = `#/s/${encodeURIComponent(view.serverId ?? '')}`
  if (view.mode === 'edit') return `${base}/edit`
  if (view.tab === 'overview') return base
  const params = new URLSearchParams()
  if (view.tab === 'caps') {
    params.set('kind', view.capKind)
    if (view.capItem) params.set('item', view.capItem)
    if (view.autorun) params.set('run', '1')
  }
  const query = params.toString()
  return `${base}/${view.tab}${query ? `?${query}` : ''}`
}

export function navigate(view: ViewState, options?: { replace?: boolean }): void {
  const hash = hashFor(view)
  if (window.location.hash === hash) return
  if (options?.replace) {
    window.history.replaceState(null, '', hash)
  } else {
    window.location.hash = hash
  }
}

export function navigateHash(hash: string, options?: { replace?: boolean }): void {
  if (window.location.hash === hash) return
  if (options?.replace) {
    window.history.replaceState(null, '', hash)
  } else {
    window.location.hash = hash
  }
}
