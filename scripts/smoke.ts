import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { McpManager } from '../src/main/mcp/manager'
import { DEFAULT_SETTINGS, Store } from '../src/main/store'
import { exportFor, parseDocument, toDrafts } from '../src/main/clients'
import type { MCPServerConfig, ServerDraft, Settings } from '../src/shared/types'

const settings: Settings = { ...DEFAULT_SETTINGS }
const mockServer = path.resolve('scripts/mock-mcp-server.mjs')

const base: MCPServerConfig = {
  id: 'mock',
  name: 'Mock',
  description: '',
  groupId: null,
  enabled: true,
  favorite: false,
  transport: 'stdio',
  command: process.execPath,
  args: [mockServer],
  env: {},
  cwd: '',
  url: '',
  headers: {},
  createdAt: Date.now(),
  updatedAt: Date.now()
}

let failures = 0

function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`  ok  ${message}`)
  } else {
    failures += 1
    console.error(`  FAIL ${message}`)
  }
}

async function main(): Promise<void> {
  const manager = new McpManager(() => settings)
  manager.on('log', (event: { serverId: string; entry: { level: string; line: string } }) => {
    console.log(`  [${event.entry.level}] ${event.entry.line}`)
  })

  console.log('\n1. connectivity test')
  const result = await manager.test(base)
  assert(result.status === 'ok', `test() status ok (latency ${result.latencyMs}ms)`)
  assert(result.serverInfo?.name === 'mock-server', `serverInfo.name = ${result.serverInfo?.name}`)
  assert(result.serverInfo?.version === '1.2.3', `serverInfo.version = ${result.serverInfo?.version}`)
  assert(result.serverInfo?.protocolVersion === '2025-06-18', `protocolVersion = ${result.serverInfo?.protocolVersion}`)

  console.log('\n2. capabilities')
  const caps = await manager.capabilities(base)
  assert(caps.tools.length === 2, `tools: ${caps.tools.map((tool) => tool.name).join(', ')}`)
  assert(caps.resources.length === 1, `resources: ${caps.resources.map((resource) => resource.uri).join(', ')}`)
  assert(caps.prompts.length === 1, `prompts: ${caps.prompts.map((prompt) => prompt.name).join(', ')}`)

  console.log('\n3. tool call')
  const echo = await manager.callTool(base, 'echo', { text: 'hi', uppercase: true })
  const echoText = echo.content[0]?.type === 'text' ? (echo.content[0] as { text: string }).text : ''
  assert(echoText === 'HI', `echo returned "${echoText}"`)

  const sum = await manager.callTool(base, 'add', { a: 2, b: 40 })
  assert(sum.structuredContent !== undefined, `structuredContent present: ${JSON.stringify(sum.structuredContent)}`)

  console.log('\n4. resource + prompt')
  const read = await manager.readResource(base, 'mock://readme')
  assert(read.contents[0]?.text === 'hello from mock server', `resource text: ${read.contents[0]?.text}`)

  const prompt = await manager.getPrompt(base, 'greet', { who: 'MCP' })
  const promptText = prompt.messages[0]?.content?.type === 'text' ? (prompt.messages[0].content as { text: string }).text : ''
  assert(promptText === 'Hello MCP!', `prompt text: ${promptText}`)

  console.log('\n5. failure path')
  const bad = { ...base, id: 'bad', command: 'definitely-not-a-real-command-xyz' }
  const badResult = await manager.test(bad)
  assert(badResult.status === 'error', `bad command reported error: ${badResult.error?.slice(0, 70)}`)

  console.log('\n6. stderr captured')
  assert(manager.logsOf('mock').some((line) => line.level === 'stderr'), 'stderr lines captured from child process')

  await manager.disposeAll()
  assert(manager.statuses()['mock'] === undefined, 'connections disposed')

  console.log('\n7. client config import/export')
  const claudeStyle = parseDocument({
    mcpServers: {
      filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:\\tmp'], env: { DEBUG: '1' } },
      remote: { type: 'sse', url: 'https://example.com/sse', headers: { Authorization: 'Bearer token' } }
    }
  })
  assert(claudeStyle.servers.length === 2, `mcpServers parsed: ${claudeStyle.servers.map((s) => `${s.name}/${s.transport}`).join(', ')}`)
  assert(claudeStyle.servers[1].transport === 'sse', 'remote entry keeps sse transport')

  const vscodeStyle = parseDocument({
    servers: {
      fetch: { type: 'stdio', command: 'uvx', args: ['mcp-server-fetch'], env: {} },
      api: { type: 'http', url: 'https://example.com/mcp' }
    }
  })
  assert(vscodeStyle.servers.length === 2, `vscode servers parsed: ${vscodeStyle.servers.map((s) => s.name).join(', ')}`)

  const opencodeStyle = parseDocument({
    mcp: {
      memory: { type: 'local', command: ['npx', '-y', '@modelcontextprotocol/server-memory'], environment: { A: 'b' }, enabled: true },
      notion: { type: 'remote', url: 'https://mcp.notion.com/sse', enabled: false }
    }
  })
  assert(opencodeStyle.servers.length === 2, `opencode mcp parsed: ${opencodeStyle.servers.map((s) => s.name).join(', ')}`)
  assert(opencodeStyle.servers[0].command === 'npx' && opencodeStyle.servers[0].args?.[1] === '@modelcontextprotocol/server-memory', 'local command array split correctly')

  const drafts: ServerDraft[] = toDrafts(claudeStyle.servers)
  assert(drafts[0].env.DEBUG === '1', 'env preserved through drafts')

  const asConfigs: MCPServerConfig[] = drafts.map((draft, index) => ({
    ...draft,
    id: `s${index}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))

  const opencodeOut = JSON.parse(exportFor('opencode', asConfigs)) as {
    mcp: Record<string, { type: string; command?: string[]; url?: string }>
  }
  assert(opencodeOut.mcp['filesystem']?.type === 'local', 'opencode export uses local type')
  assert(opencodeOut.mcp['filesystem']?.command?.[0] === 'npx', 'opencode export keeps command array')
  assert(opencodeOut.mcp['remote']?.type === 'remote', 'opencode export uses remote type')

  const vscodeOut = JSON.parse(exportFor('vscode', asConfigs)) as { servers: Record<string, { type: string }> }
  assert(vscodeOut.servers['filesystem']?.type === 'stdio', 'vscode export includes type')

  const claudeOut = JSON.parse(exportFor('claude-desktop', asConfigs)) as { mcpServers: Record<string, unknown> }
  assert(Object.keys(claudeOut.mcpServers).length === 2, 'claude desktop export has 2 entries')

  const roundTrip = parseDocument(JSON.parse(exportFor('opencode', asConfigs)))
  assert(roundTrip.servers.length === 2, 'export -> parse round trip')

  console.log('\n8. handshake probe events')
  const events: Array<{ stage: string; status: string; ms?: number }> = []
  manager.on('probe', (event: { stage: string; status: string; ms?: number }) => events.push(event))
  const probed = await manager.test(base)
  assert(probed.stages?.length === 3, `stages: ${probed.stages?.map((stage) => `${stage.key}=${stage.ms}ms`).join(' ')}`)
  assert(events.some((event) => event.stage === 'link' && event.status === 'active'), 'link active emitted')
  assert(events.some((event) => event.stage === 'handshake' && event.status === 'done'), 'handshake done emitted')
  assert(events.some((event) => event.stage === 'ping' && event.status === 'done'), 'ping done emitted')
  assert(events.some((event) => event.stage === 'link' && event.status === 'done'), 'link done emitted last')
  const stageSum = (probed.stages ?? []).reduce((total, stage) => total + stage.ms, 0)
  assert(Math.abs(stageSum - probed.latencyMs) < 30, `stage sum ${stageSum}ms matches total ${probed.latencyMs}ms`)
  await manager.disposeAll()

  console.log('\n9. delete undo')
  const tempDir = path.join(os.tmpdir(), `mcp-helper-smoke-${Date.now()}`)
  fs.mkdirSync(tempDir, { recursive: true })
  const store = new Store(tempDir)
  store.saveServer({ ...asConfigs[0], id: undefined } as unknown as ServerDraft)
  const createdId = store.getState().servers[0].id
  store.deleteServer(createdId)
  assert(store.getState().servers.length === 0, 'server removed')
  store.undoDelete()
  const restored = store.getState().servers
  assert(restored.length === 1 && restored[0].id === createdId, 'undo restored the same server')
  fs.rmSync(tempDir, { recursive: true, force: true })

  console.log(failures ? `\n${failures} check(s) failed\n` : '\nall checks passed\n')
  process.exitCode = failures ? 1 : 0
}

void main()
