'use strict';
const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const backendPath = app.isPackaged
  ? path.join(process.resourcesPath, 'backend')
  : path.join(__dirname, '..', 'backend');

const logFile = path.join(app.getPath('userData'), 'basis-startup.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(msg);
}

app.whenReady().then(() => {
  log('app ready, backendPath=' + backendPath);
  process.env.USER_DATA_PATH = app.getPath('userData');
  process.env.NODE_ENV = 'production';

  try {
    require('dotenv').config({ path: path.join(backendPath, '.env') });
    log('dotenv loaded');
  } catch (e) {
    log('dotenv skip: ' + e.message);
  }

  try {
    log('requiring server.js...');
    require(path.join(backendPath, 'server.js'));
    log('server.js loaded');
  } catch (e) {
    log('server.js FAILED: ' + e.message + '\n' + e.stack);
    dialog.showErrorBox('Basis startup error', e.message + '\n\nLog: ' + logFile);
    app.quit();
    return;
  }

  waitForBackend(createWindow);
}).catch(e => {
  fs.appendFileSync(logFile, 'FATAL: ' + e.message + '\n');
});

function waitForBackend(cb, attempts = 0) {
  http.get('http://localhost:3001/api/health', (res) => {
    if (res.statusCode === 200) {
      log('backend ready');
      cb();
    } else {
      retry(cb, attempts);
    }
  }).on('error', () => retry(cb, attempts));
}

function retry(cb, attempts) {
  if (attempts > 30) {
    const msg = 'Backend failed to start. Log: ' + logFile;
    log(msg);
    dialog.showErrorBox('Basis startup error', msg);
    app.quit();
    return;
  }
  setTimeout(() => waitForBackend(cb, attempts + 1), 500);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Basis',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:3001');

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
