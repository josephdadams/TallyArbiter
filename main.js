// This is the electron startup script
const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');
const { autoUpdater } = require("electron-updater");
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
    try {
        require("./index");
    } catch(e) {
        dialog.showErrorBox("Unexpected error", "There was an unexpected error. Please open a bug report on the project's Github page or contact one of the developers.");
    }
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
