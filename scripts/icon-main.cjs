const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="472" height="472" rx="104" fill="#1b2027" stroke="#39424d" stroke-width="5"/>
  <g stroke="#f0b73f" stroke-width="30" stroke-linecap="round" fill="none">
    <path d="M176 130v252M336 130v252"/>
    <path d="M176 194h160M176 256h160M176 318h160"/>
  </g>
</svg>`

const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000'
  })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 700))
  const image = await win.webContents.capturePage()
  const out = path.join(process.cwd(), 'build', 'icon.png')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, image.toPNG())
  console.log(`icon written: ${out} ${JSON.stringify(image.getSize())}`)
  app.quit()
})
