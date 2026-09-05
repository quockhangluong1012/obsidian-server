const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const SCHEME = 'app'
const HOST = 'obsidianvault'

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

function distRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '..', 'client', 'dist')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Obsidian Vault',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL(`${SCHEME}://${HOST}/index.html`)
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    let filePath = path.join(distRoot(), decodeURIComponent(pathname))
    if (!filePath.startsWith(distRoot())) filePath = distRoot() // block path traversal
    try {
      if (require('node:fs').statSync(filePath).isDirectory()) throw 0
    } catch {
      filePath = path.join(distRoot(), 'index.html')
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]))

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
