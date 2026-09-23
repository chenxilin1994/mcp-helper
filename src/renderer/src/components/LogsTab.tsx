import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MCPServerConfig } from '@shared/types'
import { Button, CopyButton, EmptyState, Switch, cx } from './primitives'
import { formatTime } from '../lib/format'
import { clearLogs } from '../state/actions'
import { useStore } from '../state/store'

const LEVEL_LABEL: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  protocol: 'RPC',
  stderr: 'STDERR'
}

export function LogsTab({ server }: { server: MCPServerConfig }): ReactNode {
  const lines = useStore().logs[server.id] ?? []
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [lines, autoScroll])

  const text = lines.map((line) => `[${formatTime(line.at)}] ${LEVEL_LABEL[line.level] ?? line.level} ${line.line}`).join('\n')

  return (
    <div className="logs">
      <div className="logs__bar">
        <span className="logs__count tnum">{lines.length ? `${lines.length} 行` : '没有日志'}</span>
        <span className="logs__spacer" />
        <label className="logs__toggle">
          <Switch checked={autoScroll} onChange={setAutoScroll} label="自动滚动" />
          <span>自动滚动</span>
        </label>
        <CopyButton text={text} label="复制全部日志" size={26} />
        <Button size="sm" variant="ghost" icon="trash" onClick={() => clearLogs(server.id)} disabled={!lines.length}>
          清空
        </Button>
      </div>

      <div className="logs__scroll" ref={scrollRef}>
        {lines.length === 0 ? (
          <EmptyState
            compact
            icon="terminal"
            title="暂无日志"
            description="连接服务器、枚举能力或调用工具后，JSON-RPC 事件与子进程 stderr 会实时显示在这里。"
          />
        ) : (
          lines.map((line, index) => (
            <div className={cx('logline', `logline--${line.level}`)} key={index}>
              <span className="logline__time mono tnum">{formatTime(line.at)}</span>
              <span className="logline__level">{LEVEL_LABEL[line.level] ?? line.level}</span>
              <span className="logline__text mono">{line.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
