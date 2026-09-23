import { Fragment, type ReactNode } from 'react'
import type { MCPServerConfig, TestStage } from '@shared/types'
import { cx } from './primitives'
import { formatLatency } from '../lib/format'
import type { ProbeState } from '../state/store'

const LABELS: Record<'stdio' | 'remote', Record<string, string>> = {
  stdio: { link: '进程启动', handshake: '初始化握手', ping: '心跳检测' },
  remote: { link: '建立连接', handshake: '初始化握手', ping: '心跳检测' }
}

const KEYS = ['link', 'handshake', 'ping'] as const

interface TraceCell {
  key: string
  label: string
  status: 'pending' | 'active' | 'done' | 'fail'
  ms?: number
  detail?: string
}

export function ProbeTrace({
  transport,
  probe,
  stages
}: {
  transport: MCPServerConfig['transport']
  probe?: ProbeState
  stages?: TestStage[]
}): ReactNode {
  const labels = LABELS[transport === 'stdio' ? 'stdio' : 'remote']
  const live = probe?.running === true

  const cells: TraceCell[] = KEYS.map((key) => {
    if (live) {
      const stage = probe?.stages[key]
      return {
        key,
        label: labels[key],
        status: stage?.status ?? 'pending',
        ms: stage?.ms,
        detail: stage?.detail
      }
    }
    const persisted = stages?.find((stage) => stage.key === key)
    return {
      key,
      label: persisted?.label ?? labels[key],
      status: persisted ? 'done' : 'pending',
      ms: persisted?.ms
    }
  })

  const measured = cells.filter((cell) => typeof cell.ms === 'number')
  const total = measured.reduce((sum, cell) => sum + (cell.ms ?? 0), 0)
  const failure = cells.find((cell) => cell.status === 'fail')

  return (
    <div className={cx('trace', live && 'is-live')}>
      {cells.map((cell, index) => (
        <Fragment key={cell.key}>
          {index > 0 ? <span className={cx('trace__wire', cells[index - 1].status === 'done' && 'is-done')} /> : null}
          <div className={cx('trace__stage', `is-${cell.status}`)}>
            <span className="trace__node" />
            <span className="trace__label">{cell.label}</span>
            <span className="trace__value mono tnum">{typeof cell.ms === 'number' ? formatLatency(cell.ms) : '—'}</span>
          </div>
        </Fragment>
      ))}
      <span className="trace__wire" />
      <div className="trace__stage trace__stage--total">
        <span className="trace__label">合计</span>
        <span className="trace__value mono tnum">{measured.length ? formatLatency(total) : '—'}</span>
      </div>
      {failure?.detail ? <p className="trace__detail mono">{failure.detail}</p> : null}
    </div>
  )
}
