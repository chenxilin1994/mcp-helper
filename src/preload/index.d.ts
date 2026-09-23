import type { McpHelperApi } from '../shared/api'

declare global {
  interface Window {
    api: McpHelperApi
  }
}

export {}
