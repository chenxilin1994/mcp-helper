import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Store } from './store'
import { McpManager } from './mcp/manager'
import { registerIpc } from './ipc'
import type { MCPEvent } from '../shared/types'

const argv = process.argv.slice(1)

function argValue(name: string): string | undefined {
  const index = argv.findIndex((item) => item === name)
  return index >= 0 ? argv[index + 1] : undefined
}

const captureTarget = argValue('--capture')
const captureHash = argValue('--capture-hash') ?? ''
const captureDelay = Number(argValue('--capture-delay') ?? '1400')
const captureJs = argValue('--capture-js')
const dataDir = argValue('--data-dir')
const isCapture = Boolean(captureTarget)

if (isCapture) {
  app.commandLine.appendSwitch('force-prefers-reduced-motion')
}

let mainWindow: BrowserWindow | null = null
let manager: McpManager | null = null
let quitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0e1216',
    autoHideMenuBar: true,
    title: 'MCP Helper',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']

  const ready = async (): Promise<void> => {
    if (!isCapture) {
      mainWindow?.show()
      return
    }

    await new Promise((resolve) => setTimeout(resolve, captureDelay))

    if (captureJs) {
      try {
        const outcome = await mainWindow?.webContents.executeJavaScript(captureJs)
        console.log('capture js outcome:', outcome)
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error('capture js failed', error)
      }
    }

    mainWindow?.showInactive()

    let written = false
    for (let attempt = 1; attempt <= 3 && !written; attempt += 1) {
      try {
        const image = await mainWindow?.webContents.capturePage()
        if (image && !image.isEmpty() && captureTarget) {
          fs.mkdirSync(path.dirname(captureTarget), { recursive: true })
          fs.writeFileSync(captureTarget, image.toPNG())
          written = true
        }
      } catch (error) {
        console.error(`capturePage attempt ${attempt} failed`, error)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    if (!written) console.error('capture failed after retries')
    app.exit(written ? 0 : 1)
  }

  mainWindow.once('ready-to-show', () => {
    if (!isCapture) void ready()
  })
  mainWindow.webContents.once('did-finish-load', () => {
    if (isCapture) void ready()
  })

  if (isCapture) {
    setTimeout(() => {
      console.error('capture timed out')
      app.exit(1)
    }, 25_000)
  }

  if (devUrl) {
    void mainWindow.loadURL(`${devUrl}${isCapture ? '?capture=1' : ''}${captureHash}`)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: isCapture ? { capture: '1' } : undefined,
      hash: captureHash ? captureHash.replace(/^#/, '') : undefined
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock && !isCapture) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    const dir = dataDir ?? app.getPath('userData')
    const store = new Store(dir)
    manager = new McpManager(() => store.getState().settings)

    registerIpc(store, manager, (event: MCPEvent) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('mcp:event', event)
    })

    createWindow()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', (event) => {
    if (quitting || !manager || isCapture) return
    event.preventDefault()
    quitting = true
    void manager.disposeAll().finally(() => app.quit())
  })
}
