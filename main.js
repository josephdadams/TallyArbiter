// This is the electron startup script
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require("path");

let mainWindow;
let trayIcon;

const gotTheLock = app.requestSingleInstanceLock()

function createWindow() {
    mainWindow = new BrowserWindow({
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
    mainWindow.on('close', function(event) {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
    // start the server
    require("./index");
}

function createTrayIcon() {
    trayIcon = new Tray(app.isPackaged ? path.join(process.resourcesPath, "build/trayicon.png") : "build/trayicon.png");
    trayIcon.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: 'Show',
                click: () => {
                    mainWindow.show();
                },
            },
            {
                type: "separator",
            },
            {
                label: 'Quit',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                },
            },
        ]));
    trayIcon.setToolTip("Tally Arbiter");
    trayIcon.on("click", () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}


if (!gotTheLock) {
    app.quit();
} else {
    app.whenReady().then(() => {
        createWindow();
        createTrayIcon();
        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') app.quit();
    });
}