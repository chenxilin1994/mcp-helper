import { useEffect, type ReactNode } from 'react'
import { Sidebar } from './components/Sidebar'
import { ServerList } from './components/ServerList'
import { Detail, DetailPlaceholder } from './components/Detail'
import { Editor } from './components/Editor'
import { HomePane } from './components/Home'
import { ImportExportDialog } from './components/ImportExport'
import { GroupEditorDialog, SettingsDialog } from './components/Settings'
import { ConfirmHost, ContextMenuHost, ToastHost } from './components/primitives'
import { Icon } from './components/Icons'
import { bootstrap, dismissConfirm, handleShortcutEvent, resolveConfirm } from './state/actions'
import { closeContextMenu, dismissToast, useStore } from './state/store'

export default function App(): ReactNode {
  const state = useStore()

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (handleShortcutEvent(event)) event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!state.ready) {
    return (
      <div className="boot">
        <span className="boot__mark">
          <Icon name="bus" size={26} />
        </span>
        <p className="boot__text">MCP Helper</p>
      </div>
    )
  }

  const server = state.app?.servers.find((item) => item.id === state.view.serverId) ?? null

  return (
    <div className={state.capture ? 'app is-capture' : 'app'}>
      <Sidebar />
      <ServerList />
      <main className="stage">
        {state.view.mode === 'home' ? <HomePane /> : null}
        {state.view.mode === 'detail' ? server ? <Detail server={server} /> : <DetailPlaceholder /> : null}
        {state.view.mode === 'edit' ? (
          server ? (
            <Editor key={server.id} mode="edit" server={server} />
          ) : (
            <DetailPlaceholder />
          )
        ) : null}
        {state.view.mode === 'create' ? <Editor key="create" mode="create" server={null} /> : null}
      </main>

      <ImportExportDialog />
      <SettingsDialog />
      <GroupEditorDialog />
      <ConfirmHost confirm={state.confirm} onResolve={resolveConfirm} onDismiss={dismissConfirm} />
      <ContextMenuHost menu={state.contextMenu} onClose={closeContextMenu} />
      <ToastHost toasts={state.toasts} onDismiss={dismissToast} />
    </div>
  )
}
