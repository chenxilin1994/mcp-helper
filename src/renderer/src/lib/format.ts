import type { MCPServerConfig, TransportType } from '@shared/types'

export const GROUP_COLORS: Record<string, string> = {
  blue: '#5b8def',
  teal: '#3fb5a3',
  violet: '#9a7ff0',
  amber: '#d9a441',
  rose: '#e07a8b',
  green: '#5bb87a',
  slate: '#7f8b99',
  orange: '#e08a4a'
}

export const GROUP_COLOR_NAMES = Object.keys(GROUP_COLORS)

export function groupColor(name: string): string {
  return GROUP_COLORS[name] ?? GROUP_COLORS.blue
}

export function transportLabel(transport: TransportType): string {
  if (transport === 'stdio') return 'stdio'
  if (transport === 'sse') return 'SSE'
  return 'HTTP'
}

export function commandPreview(server: MCPServerConfig): string {
  if (server.transport === 'stdio') {
    return [server.command, ...server.args].filter(Boolean).join(' ')
  }
  return server.url || '未设置地址'
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatDateTime(at: number): string {
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relativeTime(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return formatDateTime(at)
}

export function maskValue(value: string): string {
  if (!value) return ''
  const visible = value.length > 4 ? value.slice(-4) : ''
  return `${'•'.repeat(Math.min(10, Math.max(4, value.length - visible.length)))}${visible}`
}

export function isSecretKey(key: string): boolean {
  return /(key|token|secret|password|passwd|auth|credential|api)/i.test(key)
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return '已连接'
    case 'connecting':
      return '连接中'
    case 'error':
      return '连接异常'
    default:
      return '未连接'
  }
}

export function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function compactPath(value: string, maxSegments = 2): string {
  if (!value) return ''
  const normalized = value.replace(/\//g, '\\')
  const segments = normalized.split('\\').filter(Boolean)
  if (segments.length <= maxSegments + 1) return value
  return `…\\${segments.slice(-maxSegments).join('\\')}`
}
