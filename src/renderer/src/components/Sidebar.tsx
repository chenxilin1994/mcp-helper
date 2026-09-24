import { useMemo, type ReactNode } from 'react'
import { MenuButton, cx, type MenuItem } from './primitives'
import { Icon } from './Icons'
import { groupColor } from '../lib/format'
import { deleteGroup, moveGroup, openGroupEditor, openDialog, setGroupFilter } from '../state/actions'
import { useStore } from '../state/store'

export function Sidebar(): ReactNode {
  const { app, groupFilter } = useStore()

  const groups = useMemo(() => [...(app?.groups ?? [])].sort((a, b) => a.order - b.order), [app?.groups])
  const servers = app?.servers ?? []

  const countAll = servers.length
  const countUngrouped = servers.filter((server) => !server.groupId).length
  const countFor = (groupId: string): number => servers.filter((server) => server.groupId === groupId).length

  const groupMenu = (groupId: string, index: number): MenuItem[] => [
    { label: '重命名', icon: 'pencil', onSelect: () => openGroupEditor(groups.find((group) => group.id === groupId)) },
    { label: '上移', icon: 'arrowUp', onSelect: () => moveGroup(groupId, -1), disabled: index === 0 },
    { label: '下移', icon: 'arrowDown', onSelect: () => moveGroup(groupId, 1), disabled: index === groups.length - 1 },
    { separator: true },
    { label: '删除分组', icon: 'trash', danger: true, onSelect: () => deleteGroup(groupId) }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand__mark">
          <Icon name="bus" size={18} />
        </span>
        <div className="brand__text">
          <span className="brand__name">MCP Helper</span>
          <span className="brand__sub">本地 MCP 管理器</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        <p className="side-label">分组</p>

        <button
          type="button"
          className={cx('side-item', groupFilter === 'all' && 'is-active')}
          onClick={() => setGroupFilter('all')}
        >
          <Icon name="layers" size={15} />
          <span className="side-item__label">全部服务器</span>
          <span className="side-item__count tnum">{countAll}</span>
        </button>

        <button
          type="button"
          className={cx('side-item', groupFilter === 'none' && 'is-active')}
          onClick={() => setGroupFilter('none')}
        >
          <Icon name="filter" size={15} />
          <span className="side-item__label">未分组</span>
          <span className="side-item__count tnum">{countUngrouped}</span>
        </button>

        {groups.map((group, index) => (
          <div className="side-group" key={group.id}>
            <button
              type="button"
              className={cx('side-item', groupFilter === group.id && 'is-active')}
              onClick={() => setGroupFilter(group.id)}
            >
              <span className="side-item__dot" style={{ background: groupColor(group.color) }} />
              <span className="side-item__label">{group.name}</span>
              <span className="side-item__count tnum">{countFor(group.id)}</span>
            </button>
            <MenuButton
              items={groupMenu(group.id, index)}
              label={`分组 ${group.name} 操作`}
              size={22}
              className="side-group__menu"
            />
          </div>
        ))}

        <button type="button" className="side-item side-item--ghost" onClick={() => openGroupEditor()}>
          <Icon name="plus" size={15} />
          <span className="side-item__label">新建分组</span>
        </button>
      </nav>

      <div className="sidebar__foot">
        <button type="button" className="side-item" onClick={() => openDialog('import')}>
          <Icon name="import" size={15} />
          <span className="side-item__label">导入 / 导出</span>
        </button>
        <button type="button" className="side-item" onClick={() => openDialog('settings')}>
          <Icon name="settings" size={15} />
          <span className="side-item__label">设置</span>
        </button>
        <p className="sidebar__version mono">v{__APP_VERSION__} · 本地数据</p>
      </div>
    </aside>
  )
}
