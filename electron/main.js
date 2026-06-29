import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform === 'win32' && process.argv.includes('--squirrel-firstrun')) {
  app.quit();
}

const isDev = !!process.env.VITE_DEV_SERVER_URL;

const createMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/DaphneHoutackers/BiBaBench-Buddy');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/DaphneHoutackers/BiBaBench-Buddy/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Buy me a cookie',
          click: () => {
            shell.openExternal('https://www.buymeacoffee.com/daphnewoodpecker');
          },
        },
      ],
    },
    ...(isDev
      ? [
        {
          label: 'Developer',
          submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggleDevTools' },
          ],
        },
      ]
      : []),
  ]);
  Menu.setApplicationMenu(menu);
};

const createWindow = async () => {
  const pngIconPath = path.join(__dirname, '..', 'public', 'icon-512.png');

  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 788,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: pngIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      contentSecurityPolicy: isDev
        ? "default-src 'self' 'unsafe-inline' data:; connect-src 'self' ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' strict-dynamic;"
        : "default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    const menuTemplate = [];

    if (params.isEditable) {
      menuTemplate.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      );
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      menuTemplate.push({ role: 'copy' });
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  console.log('VITE_DEV_SERVER_URL:', devServerUrl);

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // macOS: Hide window instead of destroying it, so localStorage (auth session) persists
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1000);

  return mainWindow;
};

let mainWindow = null;

app.whenReady().then(async () => {
  createMenu();

  mainWindow = await createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Set quitting flag so the window close handler allows actual quit
app.on('before-quit', () => {
  app.isQuitting = true;
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version has been downloaded. Restart the app to install the update.',
      buttons: ['Restart now', 'Later'],
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on('error', (error) => {
  console.error('Auto updater error:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().then(win => { mainWindow = win; });
  }
});
