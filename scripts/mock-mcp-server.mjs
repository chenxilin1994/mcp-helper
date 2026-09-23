import process from 'node:process'

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo the input text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to echo' },
        uppercase: { type: 'boolean', description: 'Return uppercase text', default: false }
      },
      required: ['text']
    }
  },
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number', default: 2 },
        b: { type: 'number', description: 'Second number', default: 40 }
      },
      required: ['a', 'b']
    }
  }
]

const RESOURCES = [{ uri: 'mock://readme', name: 'readme', mimeType: 'text/plain', description: 'Mock readme' }]
const PROMPTS = [
  {
    name: 'greet',
    description: 'Greeting prompt',
    arguments: [{ name: 'who', description: 'Who to greet', required: true }]
  }
]

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function handle(message) {
  const { id, method, params } = message

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {}, resources: {}, prompts: {} },
      serverInfo: { name: 'mock-server', version: '1.2.3', title: 'Mock Server' },
      instructions: 'This is a mock MCP server used by smoke tests.'
    })
    return
  }

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return

  if (method === 'ping') {
    reply(id, {})
    return
  }

  if (method === 'tools/list') {
    reply(id, { tools: TOOLS })
    return
  }

  if (method === 'tools/call') {
    const name = params?.name
    const args = params?.arguments ?? {}
    if (name === 'echo') {
      const text = args.uppercase ? String(args.text).toUpperCase() : String(args.text)
      reply(id, { content: [{ type: 'text', text }] })
      return
    }
    if (name === 'add') {
      const sum = Number(args.a) + Number(args.b)
      reply(id, { content: [{ type: 'text', text: String(sum) }], structuredContent: { sum } })
      return
    }
    replyError(id, -32602, `Unknown tool: ${name}`)
    return
  }

  if (method === 'resources/list') {
    reply(id, { resources: RESOURCES })
    return
  }

  if (method === 'resources/templates/list') {
    reply(id, { resourceTemplates: [] })
    return
  }

  if (method === 'resources/read') {
    const uri = params?.uri
    if (uri !== 'mock://readme') {
      replyError(id, -32602, `Unknown resource: ${uri}`)
      return
    }
    reply(id, {
      contents: [{ uri, mimeType: 'text/plain', text: 'hello from mock server' }]
    })
    return
  }

  if (method === 'prompts/list') {
    reply(id, { prompts: PROMPTS })
    return
  }

  if (method === 'prompts/get') {
    const who = params?.arguments?.who ?? 'world'
    reply(id, {
      description: 'greeting',
      messages: [{ role: 'user', content: { type: 'text', text: `Hello ${who}!` } }]
    })
    return
  }

  if (id !== undefined) replyError(id, -32601, `Method not found: ${method}`)
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    try {
      handle(JSON.parse(line))
    } catch (error) {
      process.stderr.write(`mock server parse error: ${error.message}\n`)
    }
  }
})

process.stderr.write('mock mcp server started\n')
