// This is the electron startup script
const { app, BrowserWindow } = require('electron');
require("./index");

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minHeight: 850,
        minWidth: 1260,
        webPreferences: {},
        show: false,
    });
    mainWindow.setMenu(null);
    mainWindow.loadURL('http://127.0.0.1:4455');
    mainWindow.webContents.on('did-finish-load', function() {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', function() {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') app.quit();
});