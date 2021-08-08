// This is the electron startup script
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require('fs');

let server;
let mainWindow;
let trayIcon;

const gotTheLock = app.requestSingleInstanceLock()

function processError(err) {
    console.error(err);
    const errorWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minHeight: 850,
        minWidth: 1260,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false
    });
    errorWindow.setMenu(null);

    let logs = "No log obtained before the error."
    let logsFilePath = server.logFilePath;
    if (fs.existsSync(logsFilePath)) {
        logs = fs.readFileSync(logsFilePath, 'utf8');
    }
    ipcMain.on('pageLoaded', (event, arg) => {
        event.reply("stacktrace", err.stack);
        event.reply("logs", logs);
        event.reply("config", JSON.stringify(server.getConfig(), null, 2));
    });
    ipcMain.on('bugReportButtonPressed', (event, arg) => {
        let url = `https://github.com/josephdadams/TallyArbiter/issues/new?labels=bug&template=bug.yaml&title=%5BBug%5D%3A+&version=${app.getVersion()}&logs=${encodeURIComponent(logs)}`;
        shell.openExternal(url);
    });

    errorWindow.loadFile("electron_error_page.html").then(() => {
        errorWindow.show();
        if(mainWindow !== undefined) mainWindow.blur();
        errorWindow.focus();
    }).catch((err) => { console.error(err); });
}

process.on('uncaughtException', (err) => {
    processError(err);
})

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
    server = require("./index");
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

function checkForUpdates() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.checkForUpdates();
    autoUpdater.on("update-available", () => {
        dialog.showMessageBox(mainWindow, {
            title: "Update Available",
            message: "There's an update available for TallyArbiter. Do you want to download and install it?",
            buttons: ["Update", "Cancel"],
        }).then((v) => {
            if (v.response == 0) {
                dialog.showMessageBox(mainWindow, {
                    title: "Downloading update",
                    message: "The update is being downloaded in the background. Once finished, you will be prompted to save your work and restart TallyArbiter."
                });
                autoUpdater.downloadUpdate();
            }
        });
    });
    autoUpdater.on("update-downloaded", () => {
        dialog.showMessageBox(null, {
            title: "Update downloaded",
            message: "The update has been downloaded. Save your work and then press the Update button.",
            buttons: ["Update"],
        }).then((r) => {
            if (r.response == 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });
}


if (!gotTheLock) {
    app.quit();
} else {
    app.whenReady().then(() => {
        createWindow();
        createTrayIcon();
        checkForUpdates();
        app.on('activate', function () {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    }).catch((err) => {
        processError(err);
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

    // Listen for web contents being created
    app.on('web-contents-created', (e, contents) => {
        if (contents.getType() == 'window') {
            // Listen for any new window events
            contents.on('new-window', (e, url) => {
                e.preventDefault();
                const win = new BrowserWindow({ show: false });
                win.loadURL(url);
                win.setMenu(null);
                win.webContents.on('did-finish-load', function() {
                    win.show();
                });
            });
        }
    })
}
