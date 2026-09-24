export type ShortcutAction =
  | 'newServer'
  | 'search'
  | 'nextServer'
  | 'prevServer'
  | 'openImport'
  | 'openSettings'
  | 'testCurrent'
  | 'testAll'
  | 'editCurrent'
  | 'toggleFavorite'
  | 'tabOverview'
  | 'tabCaps'
  | 'tabLogs'
  | 'tabJson'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'

export interface ShortcutMeta {
  id: ShortcutAction
  label: string
  group: '导航' | '服务器' | '视图'
}

export const SHORTCUT_ACTIONS: ShortcutMeta[] = [
  { id: 'newServer', label: '新建 MCP', group: '导航' },
  { id: 'search', label: '聚焦搜索框', group: '导航' },
  { id: 'nextServer', label: '下一个服务器', group: '导航' },
  { id: 'prevServer', label: '上一个服务器', group: '导航' },
  { id: 'openImport', label: '打开导入 / 导出', group: '导航' },
  { id: 'openSettings', label: '打开设置', group: '导航' },
  { id: 'testCurrent', label: '测试当前服务器', group: '服务器' },
  { id: 'testAll', label: '测试全部服务器', group: '服务器' },
  { id: 'editCurrent', label: '编辑当前服务器', group: '服务器' },
  { id: 'toggleFavorite', label: '收藏 / 取消收藏当前', group: '服务器' },
  { id: 'tabOverview', label: '切换到「概览」', group: '视图' },
  { id: 'tabCaps', label: '切换到「能力」', group: '视图' },
  { id: 'tabLogs', label: '切换到「日志」', group: '视图' },
  { id: 'tabJson', label: '切换到「JSON」', group: '视图' },
  { id: 'zoomIn', label: '放大界面', group: '视图' },
  { id: 'zoomOut', label: '缩小界面', group: '视图' },
  { id: 'zoomReset', label: '界面恢复 100%', group: '视图' }
]

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  newServer: 'Ctrl+N',
  search: 'Ctrl+K',
  nextServer: 'Alt+ArrowDown',
  prevServer: 'Alt+ArrowUp',
  openImport: 'Ctrl+I',
  openSettings: 'Ctrl+,',
  testCurrent: 'F5',
  testAll: 'Ctrl+F5',
  editCurrent: 'Ctrl+E',
  toggleFavorite: 'Ctrl+D',
  tabOverview: 'Alt+1',
  tabCaps: 'Alt+2',
  tabLogs: 'Alt+3',
  tabJson: 'Alt+4',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0'
}

export interface Option<T> {
  value: T
  label: string
}

export type ThemePalette = 'signal' | 'deep' | 'moss' | 'plum' | 'ember' | 'mono'

export const THEME_PALETTES: Array<Option<ThemePalette> & { color: string; hint: string }> = [
  { value: 'signal', label: '信号黄', color: '#f0b73f', hint: '石墨底 + 信号黄，默认' },
  { value: 'deep', label: '深海青', color: '#5ec8dd', hint: '冷调蓝黑 + 青' },
  { value: 'moss', label: '苔绿', color: '#7cc98d', hint: '绿灰底 + 苔绿' },
  { value: 'plum', label: '品紫', color: '#b98ce8', hint: '紫灰底 + 品紫' },
  { value: 'ember', label: '暖橙', color: '#eb9b52', hint: '暖灰底 + 橙' },
  { value: 'mono', label: '单色', color: '#ccd3da', hint: '全灰阶，颜色只表达状态' }
]

export type UiFont = 'system' | 'display' | 'yahei' | 'mono'

export const UI_FONTS: Array<Option<UiFont>> = [
  { value: 'system', label: '系统默认 (Segoe UI)' },
  { value: 'display', label: '工程体 (Bahnschrift)' },
  { value: 'yahei', label: '微软雅黑' },
  { value: 'mono', label: '等宽 (Cascadia Code)' }
]

export type MonoFont = 'cascadia' | 'consolas' | 'system'

export const MONO_FONTS: Array<Option<MonoFont>> = [
  { value: 'cascadia', label: 'Cascadia Code' },
  { value: 'consolas', label: 'Consolas' },
  { value: 'system', label: '跟随系统等宽字体' }
]

export const FONT_SCALES: Array<Option<number>> = [
  { value: 0.92, label: '小' },
  { value: 1, label: '标准' },
  { value: 1.08, label: '大' },
  { value: 1.16, label: '特大' }
]

export const ZOOM_LEVELS: Array<Option<number>> = [
  { value: 0.8, label: '80%' },
  { value: 0.9, label: '90%' },
  { value: 1, label: '100%' },
  { value: 1.1, label: '110%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' }
]
