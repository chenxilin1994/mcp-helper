import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const mockServer = path.join(root, 'scripts', 'mock-mcp-server.mjs')
const outDir = path.join(root, '.impeccable', 'review')
fs.mkdirSync(outDir, { recursive: true })

const fixtureDir = path.join(os.tmpdir(), 'mcp-helper-capture-fixture')
const lightDir = path.join(os.tmpdir(), 'mcp-helper-capture-light')
const deepDir = path.join(os.tmpdir(), 'mcp-helper-capture-deep')
const emptyDir = path.join(os.tmpdir(), 'mcp-helper-capture-empty')
for (const dir of [fixtureDir, lightDir, deepDir, emptyDir]) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

const now = Date.now()
const hour = 3_600_000
const day = 24 * hour

const servers = [
  {
    id: 'demo',
    name: 'Everything 参考服务',
    description: '官方参考实现，覆盖工具、资源与提示词，用于验证 MCP Helper 的完整链路。',
    groupId: 'g-dev',
    enabled: true,
    favorite: true,
    transport: 'stdio',
    command: process.execPath,
    args: [mockServer],
    env: {},
    cwd: '',
    url: '',
    headers: {},
    createdAt: now - 3 * day,
    updatedAt: now - hour,
    lastTest: {
      status: 'ok',
      latencyMs: 83,
      at: now - 10 * 60_000,
      stages: [
        { key: 'link', label: '进程启动', ms: 58 },
        { key: 'handshake', label: '初始化握手', ms: 17 },
        { key: 'ping', label: '心跳检测', ms: 8 }
      ],
      serverInfo: {
        name: 'mock-server',
        version: '1.2.3',
        title: 'Mock Server',
        protocolVersion: '2025-06-18',
        capabilities: { tools: {}, resources: {}, prompts: {} },
        instructions: 'This is a mock MCP server used by smoke tests.'
      }
    }
  },
  {
    id: 'fs',
    name: '文件系统',
    description: '读写本地项目目录，支持批量文本操作。',
    groupId: 'g-dev',
    enabled: true,
    favorite: false,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:\\projects\\demo'],
    env: { LOG_LEVEL: 'info' },
    cwd: '',
    url: '',
    headers: {},
    createdAt: now - 9 * day,
    updatedAt: now - 2 * hour,
    lastTest: {
      status: 'ok',
      latencyMs: 412,
      at: now - 2 * hour,
      stages: [
        { key: 'link', label: '进程启动', ms: 287 },
        { key: 'handshake', label: '初始化握手', ms: 96 },
        { key: 'ping', label: '心跳检测', ms: 29 }
      ],
      serverInfo: {
        name: 'mcp-server-filesystem',
        version: '0.6.2',
        protocolVersion: '2025-06-18',
        capabilities: { tools: {}, resources: {} }
      }
    }
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '',
    groupId: 'g-work',
    enabled: true,
    favorite: false,
    transport: 'http',
    command: '',
    args: [],
    env: {},
    cwd: '',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: 'Bearer demo-token-1234' },
    createdAt: now - 14 * day,
    updatedAt: now - day,
    lastTest: {
      status: 'error',
      latencyMs: 3021,
      at: now - day,
      error: 'fetch failed: connect ETIMEDOUT 140.82.112.6:443'
    }
  },
  {
    id: 'notion',
    name: 'Notion',
    description: '',
    groupId: null,
    enabled: true,
    favorite: false,
    transport: 'sse',
    command: '',
    args: [],
    env: {},
    cwd: '',
    url: 'https://mcp.notion.com/sse',
    headers: {},
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day
  },
  {
    id: 'memory',
    name: '记忆图谱',
    description: '跨会话保存实体与关系。',
    groupId: 'g-work',
    enabled: false,
    favorite: false,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: { MEMORY_FILE_PATH: 'C:\\Users\\xilig\\.mcp\\memory.json' },
    cwd: '',
    url: '',
    headers: {},
    createdAt: now - 20 * day,
    updatedAt: now - 3 * day,
    lastTest: {
      status: 'ok',
      latencyMs: 268,
      at: now - 3 * day,
      stages: [
        { key: 'link', label: '进程启动', ms: 182 },
        { key: 'handshake', label: '初始化握手', ms: 61 },
        { key: 'ping', label: '心跳检测', ms: 25 }
      ],
      serverInfo: {
        name: 'mcp-server-memory',
        version: '0.6.3',
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} }
      }
    }
  }
]

const baseState = {
  version: 1,
  settings: { theme: 'dark', connectTimeoutMs: 30_000, callTimeoutMs: 60_000 },
  groups: [
    { id: 'g-dev', name: '开发', color: 'blue', order: 0 },
    { id: 'g-work', name: '办公', color: 'violet', order: 1 }
  ],
  servers
}

fs.writeFileSync(path.join(fixtureDir, 'mcp-helper.json'), JSON.stringify(baseState, null, 2))
fs.writeFileSync(
  path.join(lightDir, 'mcp-helper.json'),
  JSON.stringify({ ...baseState, settings: { ...baseState.settings, theme: 'light' } }, null, 2)
)

fs.writeFileSync(
  path.join(deepDir, 'mcp-helper.json'),
  JSON.stringify({ ...baseState, settings: { ...baseState.settings, theme: 'dark', palette: 'deep' } }, null, 2)
)

const views = [
  { name: '01-empty', dir: emptyDir, hash: '#/', delay: 1400 },
  { name: '02-home', dir: fixtureDir, hash: '#/?stay=1', delay: 1400 },
  { name: '03-overview', dir: fixtureDir, hash: '#/s/demo', delay: 1400 },
  {
    name: '04-caps',
    dir: fixtureDir,
    hash: '#/s/demo/caps?kind=tools&item=add&run=1',
    delay: 2600,
    js: "new Promise(function(resolve){var t=setInterval(function(){var el=document.querySelector('.caps__detail');var r=document.querySelector('.result');if(el&&r){el.scrollTop=el.scrollHeight;setTimeout(function(){el.scrollTop=el.scrollHeight;clearInterval(t);resolve('scrolled')},400)}},200);setTimeout(function(){clearInterval(t);resolve('timeout')},9000)})"
  },
  { name: '05-editor', dir: fixtureDir, hash: '#/new', delay: 1400 },
  { name: '06-import', dir: fixtureDir, hash: '#/import', delay: 1400 },
  { name: '07-logs', dir: fixtureDir, hash: '#/s/demo/logs', delay: 1400 },
  { name: '08-light', dir: lightDir, hash: '#/s/demo', delay: 1400 },
  { name: '09-settings-appearance', dir: fixtureDir, hash: '#/settings', delay: 1500 },
  {
    name: '10-settings-shortcuts',
    dir: fixtureDir,
    hash: '#/settings',
    delay: 1500,
    js: "new Promise(function(resolve){var t=setInterval(function(){var dialogs=Array.prototype.slice.call(document.querySelectorAll('.dialog'));var d=dialogs.filter(function(x){var el=x.querySelector('.dialog__title');return el&&el.textContent==='设置'})[0];if(d){var items=d.querySelectorAll('.segmented__item');if(items.length>2){items[1].click();clearInterval(t);resolve('clicked')}}},200);setTimeout(function(){clearInterval(t);resolve('timeout')},8000)})"
  },
  { name: '11-palette-deep', dir: deepDir, hash: '#/s/demo', delay: 1500 }
]

let failures = 0
for (const view of views) {
  const png = path.join(outDir, `${view.name}.png`)
  let ok = false
  for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
    fs.rmSync(png, { force: true })
    const args = [
      '.',
      '--capture',
      png,
      '--capture-hash',
      view.hash,
      '--data-dir',
      view.dir,
      '--capture-delay',
      String(view.delay + (attempt - 1) * 900)
    ]
    if (view.js) args.push('--capture-js', view.js)
    const result = spawnSync(electron, args, { cwd: root, stdio: 'inherit' })
    ok = result.status === 0 && fs.existsSync(png)
    if (!ok) console.log(`    retry ${view.name} (attempt ${attempt})`)
  }
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${view.name}${fs.existsSync(png) ? ` (${(fs.statSync(png).size / 1024).toFixed(0)} KB)` : ''}`)
}

console.log(failures ? `${failures} capture(s) failed` : 'all captures written to .impeccable/review')
process.exitCode = failures ? 1 : 0
