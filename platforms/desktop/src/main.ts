import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Session,
  session,
} from 'electron';
import * as path from 'path';
import { ChildProcess, fork } from 'child_process';
import { Readable } from 'stream';
import * as fs from 'fs';
// import './app/app.element.ts';

function stripAnsiColors(text: string): string {
  return text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  );
}

function registerGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    mainWindow!.webContents.send('show-server-log', inMemoryData.serverLog);
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow!.webContents.openDevTools();
  });
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
}

function getExpressPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar',
      'platforms',
      'server',
      'main.js',
    );
  } else {
    return path.join(__dirname, 'dist', 'platforms', 'server', 'main.js');
  }
}

function createExpressApp() {
  const expressPath = getExpressPath();
  // Check if the file exists
  if (!fs.existsSync(expressPath)) {
    console.error(`File not found: ${expressPath}`);
    return;
  }
  // create express app with child process
  expressAppProcess = fork(appName, [expressPath], {
    env: { ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  // log express app output to main window
  [
    expressAppProcess.stdout,
    expressAppProcess.stderr,
    expressAppProcess,
  ].forEach((stream: Readable) => {
    if (!stream) {
      inMemoryData.serverLog.push(`Stream is not available`);
      return;
    }
    stream.on('data', (data: any) => {
      if (!mainWindow) return;
      data
        .toString()
        .split('\n')
        .forEach((line: string) => {
          if (line.trim() !== '') {
            console.log(line);
            inMemoryData.serverLog.push(line);
            mainWindow!.webContents.send(
              'server-log-entry',
              'Express server process: ',
              stripAnsiColors(line),
            );
          }
        });
    });
    stream.on('message', (message: any) => {
      if (message.trim() !== '') {
        console.log(message);
        inMemoryData.serverLog.push(message);
        mainWindow!.webContents.send(
          'server-log-entry',
          'Express server process: ',
          stripAnsiColors(message),
        );
      }
    });
    stream.on('error', (message: any) => {
      if (message.trim() !== '') {
        console.log(message);
        inMemoryData.serverLog.push(message);
        mainWindow!.webContents.send(
          'server-log-entry',
          'Express server process: ',
          stripAnsiColors(message),
        );
      }
    });
  });
}

function createWindow(session: Session) {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 650,
    webPreferences: {
      accessibleTitle: 'AI Agent H Desktop',
      preload: path.join(__dirname, 'preload.js'),
      // SECURITY: use a custom session without a cache
      // https://github.com/1password/electron-secure-defaults/#disable-session-cache
      session,
      // SECURITY: disable node integration for remote content
      // https://github.com/1password/electron-secure-defaults/#rule-2
      nodeIntegration: false,
      // SECURITY: enable context isolation for remote content
      // https://github.com/1password/electron-secure-defaults/#rule-3
      contextIsolation: true,
      // SECURITY: disable the remote module
      // https://github.com/1password/electron-secure-defaults/#remote-module
      // enableRemoteModule: false,
      // SECURITY: sanitize JS values that cross the contextBridge
      // https://github.com/1password/electron-secure-defaults/#rule-3
      // worldSafeExecuteJavaScript: true,
      javascript: true,
      // SECURITY: restrict dev tools access in the packaged app
      // https://github.com/1password/electron-secure-defaults/#restrict-dev-tools
      // devTools: !app.isPackaged,
      // SECURITY: disable navigation via middle-click
      // https://github.com/1password/electron-secure-defaults/#disable-new-window
      disableBlinkFeatures: 'Auxclick',
      // SECURITY: sandbox renderer content
      // https://github.com/1password/electron-secure-defaults/#sandbox
      sandbox: true,
    },
    width: 993,
    icon: path.join(__dirname, 'assets/icons/logo.png'),
    title: 'Storj Cloud Desktop',
    backgroundColor: '#f5f6fa',
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    expressAppProcess.kill();
  });

  mainWindow.on('focus', registerGlobalShortcuts);
  mainWindow.on('blur', unregisterAllShortcuts);
  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../browser', `./index.html`));

  // Open the DevTools.
  // if (!app.isPackaged) {
  mainWindow.webContents.openDevTools();
  // }
}

const inMemoryData = {
  serverLog: [],
};
const expressAppUrl = 'http://127.0.0.1:3000';
const appName = app.getPath('exe');
let expressAppProcess: ChildProcess | null;
let mainWindow: BrowserWindow | null;
// SECURITY: sandbox all renderer content
// https://github.com/1password/electron-secure-defaults/#sandox
app.enableSandbox();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // SECURITY: use a custom persistent session without a cache
  // https://github.com/1password/electron-secure-defaults/#disable-session-cache
  const secureSession = session.fromPartition('persist:app', {
    cache: false,
  });
  createExpressApp();
  createWindow(secureSession);
  registerGlobalShortcuts();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow(secureSession);
  });

  const checkServerRunning = setInterval(() => {
    mainWindow!.webContents.send(
      'server-log-entry',
      'Electron process: ',
      stripAnsiColors(`Checking if server is running...`),
    );
    mainWindow!.webContents.send(
      'server-log-entry',
      'Electron process: ',
      stripAnsiColors(`Express path: ${getExpressPath()}`),
    );
    inMemoryData.serverLog.push(
      `Checking if server is running on ${getExpressPath()}...`,
    );
    fetch(expressAppUrl)
      .then((response) => {
        if (response.status === 200) {
          clearInterval(checkServerRunning);
          mainWindow!.webContents.send('server-running', 'Electron process: ');
          inMemoryData.serverLog.push('Server is running!');
        }
      })
      .catch((err) => {
        mainWindow!.webContents.send(
          'server-log-entry',
          'Electron process: ',
          stripAnsiColors(`Error: ${err}`),
        );
        inMemoryData.serverLog.push(`Error: ${err}`);
      }); // swallow exception
  }, 2000);

  // SECURITY: deny permission requests from renderer
  // https://github.com/1password/electron-secure-defaults/#rule-4
  secureSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );

  // SECURITY: define a strict CSP
  // https://github.com/1password/electron-secure-defaults/#rule-6
  secureSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: /* eng-disable CSP_GLOBAL_CHECK */ {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src: 'self'; object-src: 'none'"],
      },
    });
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  mainWindow = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_ev, contents) => {
  // SECURITY: verify webview options before creation
  // https://github.com/1password/electron-secure-defaults/#rule-11
  const preventDefault = (ev: Electron.Event) => {
    ev.preventDefault();
  };
  contents.on('will-attach-webview', preventDefault);

  // SECURITY: disable or limit navigation
  // https://github.com/1password/electron-secure-defaults/#rule-12
  contents.on('will-navigate', preventDefault); // eng-disable LIMIT_NAVIGATION_GLOBAL_CHECK

  // SECURITY: disable or limit creation of new windows
  // https://github.com/1password/electron-secure-defaults/#rule-13
  // contents.on('will-frame-navigate', preventDefault); // eng-disable LIMIT_NAVIGATION_GLOBAL_CHECK

  // SECURITY: further prevent new window creation
  // https://github.com/1password/electron-secure-defaults/#prevent-new-window
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

// Handle messages and invocations coming from the renderer API
ipcMain.on('sayHello', (_ev, name: string) => {
  inMemoryData.serverLog.push(`Hello, ${name}, from the renderer process!`);
});

ipcMain.handle('get-express-app-url', () => expressAppUrl);
ipcMain.handle('getAppMetrics', () => app.getAppMetrics());
ipcMain.handle('get-electron-app-logs', () => inMemoryData.serverLog);
