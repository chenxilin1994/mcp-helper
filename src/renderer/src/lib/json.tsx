import { useMemo, type ReactNode } from 'react'

interface Token {
  text: string
  cls: string
}

const TOKEN_RE = /"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]|\s+|[^\s"]+/g

export function tokenizeJson(text: string): Token[] {
  const tokens: Token[] = []
  TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const raw = match[0]
    let cls = ''
    if (raw.startsWith('"')) {
      cls = /^\s*:/.test(text.slice(TOKEN_RE.lastIndex)) ? 'tok-key' : 'tok-str'
    } else if (raw === 'true' || raw === 'false' || raw === 'null') {
      cls = 'tok-lit'
    } else if (/^-?\d/.test(raw)) {
      cls = 'tok-num'
    } else if (/^[{}[\],:]$/.test(raw)) {
      cls = 'tok-punct'
    } else if (/^\s+$/.test(raw)) {
      cls = 'tok-ws'
    } else {
      cls = 'tok-plain'
    }
    tokens.push({ text: raw, cls })
  }
  return tokens
}

export function stringifyJson(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

export function useHighlighted(value: unknown): ReactNode {
  return useMemo(() => {
    const text = stringifyJson(value)
    return tokenizeJson(text).map((token, index) => (
      <span key={index} className={token.cls}>
        {token.text}
      </span>
    ))
  }, [value])
}

export function JsonBlock({ value, maxHeight }: { value: unknown; maxHeight?: number }): ReactNode {
  const content = useHighlighted(value)
  return (
    <pre className="code-block" style={maxHeight ? { maxHeight } : undefined}>
      <code>{content}</code>
    </pre>
  )
}

export function parseJsonSafe(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
