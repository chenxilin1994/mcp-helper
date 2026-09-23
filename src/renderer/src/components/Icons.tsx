import type { ReactNode } from 'react'
import type { TransportType } from '@shared/types'

export const iconPaths = {
  bus: (
    <>
      <path d="M6.5 3.5v17M17.5 3.5v17" />
      <path d="M6.5 8.4h11M6.5 12h11M6.5 15.6h11" />
    </>
  ),
  pipe: (
    <>
      <path d="M3.4 12h5.1M15.5 12h5.1" />
      <rect x="8.5" y="9.4" width="7" height="5.2" rx="1.2" />
    </>
  ),
  stream: (
    <>
      <path d="M4 8.5h12.2M4 12h15.2M4 15.5h7.6" />
      <circle cx="19.3" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  endpoint: (
    <>
      <rect x="3.5" y="7" width="6.5" height="10" rx="1.4" />
      <path d="M10 12h7.4" />
      <path d="M14.5 9.2L17.8 12l-3.3 2.8" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 8.9V5.6M12 15.1v3.3M8.9 12H5.6M15.1 12h3.3" />
      <circle cx="12" cy="4" r="1.5" />
      <circle cx="12" cy="20" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="20" cy="12" r="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.2 16.2L20.5 20.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.9a1.6 1.6 0 0 0 .32 1.77l.06.06a1.9 1.9 0 1 1-2.69 2.69l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.04-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a1.9 1.9 0 1 1-2.69-2.69l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a1.9 1.9 0 1 1 0-3.8h.09a1.6 1.6 0 0 0 1.47-1.04 1.6 1.6 0 0 0-.32-1.77l-.06-.06a1.9 1.9 0 1 1 2.69-2.69l.06.06a1.6 1.6 0 0 0 1.77.32h.01a1.6 1.6 0 0 0 .97-1.47V3a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a1.9 1.9 0 1 1 2.69 2.69l-.06.06a1.6 1.6 0 0 0-.32 1.77v.01a1.6 1.6 0 0 0 1.47.97H21a1.9 1.9 0 1 1 0 3.8h-.09a1.6 1.6 0 0 0-1.47.97z" />
    </>
  ),
  trash: (
    <path d="M4 7h16M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M6.6 7l.75 12.2a1.4 1.4 0 0 0 1.4 1.3h6.5a1.4 1.4 0 0 0 1.4-1.3L17.4 7M10.2 11v6M13.8 11v6" />
  ),
  pencil: (
    <>
      <path d="M4 20h4L19.2 8.8a2.05 2.05 0 0 0-2.9-2.9L5 17.2z" />
      <path d="M14.6 6.6l2.9 2.9" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronUp: <path d="M6 14.5l6-6 6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  star: <path d="M12 3.8l2.5 5 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" />,
  starFilled: (
    <path
      d="M12 3.8l2.5 5 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"
      fill="currentColor"
      stroke="currentColor"
    />
  ),
  refresh: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4.5V9h-4.5" />,
  play: <path d="M8.5 5.8v12.4L19 12z" />,
  plug: (
    <>
      <path d="M9 3.5V9M15 3.5V9" />
      <path d="M6.8 9h10.4v2.6a5.2 5.2 0 0 1-5.2 5.2 5.2 5.2 0 0 1-5.2-5.2z" />
      <path d="M12 16.8V20.5" />
    </>
  ),
  power: (
    <>
      <path d="M12 3.5v8" />
      <path d="M6.6 6.8a8 8 0 1 0 10.8 0" />
    </>
  ),
  terminal: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
      <path d="M7.5 10l2.8 2.4-2.8 2.4M12.8 15h4" />
    </>
  ),
  wrench: (
    <path d="M14.6 6.5a1 1 0 0 0 0 1.4l1.5 1.5a1 1 0 0 0 1.4 0l3.6-3.6a6 6 0 0 1-7.8 7.4l-6.5 6.5a1.9 1.9 0 0 1-2.7-2.7l6.5-6.5a6 6 0 0 1 7.4-7.8z" />
  ),
  file: (
    <>
      <path d="M6 3.5h7.5L18 8v12.5H6z" />
      <path d="M13.5 3.5V8H18M9.3 12.5h5.4M9.3 16h5.4" />
    </>
  ),
  message: (
    <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5.6L7.5 19.5v-4H6.5a2 2 0 0 1-2-2z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.3 2.4 3.5 5.3 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.3-3.5-8.5s1.2-6.1 3.5-8.5z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4L2.8 19.5h18.4z" />
      <path d="M12 10v4.2M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.8h.01" />
    </>
  ),
  import: <path d="M12 4v10.5M7.5 10L12 14.5 16.5 10M5 19.5h14" />,
  export: <path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 19.5h14" />,
  external: (
    <>
      <path d="M13.5 5H19v5.5M19 5l-7.5 7.5" />
      <path d="M9 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6.2 5.8 12 5.8 21.5 12 21.5 12 17.8 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.9 6.2A9.4 9.4 0 0 1 12 6c5.8 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.5M6.4 8.2A17.4 17.4 0 0 0 2.5 12s3.7 6 9.5 6a9.2 9.2 0 0 0 3.4-.6" />
      <path d="M10.2 10.5a2.8 2.8 0 0 0 3.6 3.9" />
    </>
  ),
  kebab: (
    <>
      <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  folder: <path d="M4 7a2 2 0 0 1 2-2h3.2l2 2.4H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
  server: (
    <>
      <rect x="4" y="4.5" width="16" height="6" rx="1.5" />
      <rect x="4" y="13.5" width="16" height="6" rx="1.5" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </>
  ),
  pulse: <path d="M3 12h3.8l2.4-6 4 12 2.5-6H21" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6z" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  link: (
    <>
      <path d="M10.2 13.8a4.6 4.6 0 0 0 6.5 0l2-2a4.6 4.6 0 0 0-6.5-6.5l-1 1" />
      <path d="M13.8 10.2a4.6 4.6 0 0 0-6.5 0l-2 2a4.6 4.6 0 0 0 6.5 6.5l1-1" />
    </>
  ),
  zap: <path d="M13 3L5 13.2h5L9.4 21l8-10.4h-5z" />,
  filter: <path d="M4 6.5h16M7.5 12h9M10.5 17.5h3" />,
  layers: (
    <>
      <path d="M12 3.8l8 4.3-8 4.3-8-4.3z" />
      <path d="M4 12.5l8 4.3 8-4.3" />
    </>
  ),
  hand: <path d="M18 11V6.5a1.8 1.8 0 0 0-3.6 0V11m0-1V4.8a1.8 1.8 0 0 0-3.6 0V11m0-.5V6.3a1.8 1.8 0 1 0-3.6 0V15a6 6 0 0 0 6 6h1.2a5 5 0 0 0 5-5v-3.7a1.8 1.8 0 1 0-3.6 0" />
}

export type IconName = keyof typeof iconPaths

const TRANSPORT_GLYPH: Record<TransportType, IconName> = {
  stdio: 'pipe',
  sse: 'stream',
  http: 'endpoint'
}

export function TransportGlyph({
  transport,
  size = 14,
  className
}: {
  transport: TransportType
  size?: number
  className?: string
}): ReactNode {
  return <Icon name={TRANSPORT_GLYPH[transport]} size={size} className={className} />
}

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 1.7
}: {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}): ReactNode {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  )
}
