// This is the electron startup script
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, powerMonitor } = require('electron')
const { autoUpdater } = require('electron-updater')
const { nativeImage } = require('electron/common')
const path = require('path')

let server
let mainWindow
let trayIcon

const WindowProperties = {
	width: 1260,
	height: 850,
	minWidth: 450,
	minHeight: 450,
}

const gotTheLock = app.requestSingleInstanceLock()

function processError(err) {
	if (server !== undefined) {
		server.generateAndSendErrorReport(err)
	} else {
		dialog.showErrorBox(
			'Unexpected error',
			"There was an unexpected error, and there was an other error generating the error report. Please open a bug report on the project's Github page or contact one of the developers. Stack Trace: " +
				err.toString(),
		)
	}
}

process.on('uncaughtException', processError)

function createWindow() {
	mainWindow = new BrowserWindow({
		width: WindowProperties.width,
		height: WindowProperties.height,
		minWidth: WindowProperties.minWidth,
		minHeight: WindowProperties.minHeight,
		webPreferences: {},
		show: false,
	})
	mainWindow.setMenu(null)
	mainWindow.loadURL('http://127.0.0.1:4455')
	mainWindow.webContents.on('did-finish-load', function () {
		mainWindow.show()
	})
	mainWindow.on('close', function (event) {
		if (!app.isQuiting) {
			event.preventDefault()
			mainWindow.hide()
		}
		return false
	})
	// start the server
	server = require('./dist/index')
}

function createTrayIcon() {
	const icon = path.join(process.resourcesPath, 'build/icon.png')
	const nativeIcon = nativeImage.createFromPath(icon)
	trayIcon = new Tray(app.isPackaged ? nativeIcon.resize({ width: 32 }) : nativeIcon.resize({ width: 32 }))
	trayIcon.setContextMenu(
		Menu.buildFromTemplate([
			{
				label: 'Show',
				click: () => {
					mainWindow.show()
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Quit',
				click: () => {
					dialog
						.showMessageBox(mainWindow, {
							title: 'Are you sure?',
							message: 'Are you sure you want to quit TallyArbiter?',
							buttons: ['Yes', 'No'],
						})
						.then((v) => {
							if (v.response == 0) {
								app.isQuiting = true
								app.quit()
							}
						})
				},
			},
		]),
	)
	trayIcon.setToolTip('Tally Arbiter')
	trayIcon.on('click', () => {
		if (mainWindow.isVisible()) {
			mainWindow.hide()
		} else {
			mainWindow.show()
		}
	})
}

function checkForUpdates() {
	autoUpdater.autoDownload = false
	autoUpdater.autoInstallOnAppQuit = false
	autoUpdater.checkForUpdates()
	autoUpdater.on('update-available', (info) => {
		ipcMain.on('updateButtonPressed', (event, arg) => {
			if (info.releaseNotes.includes('WARNING')) {
				dialog
					.showMessageBox(releaseNotesWindow, {
						title: 'Warning',
						message:
							'Please read release notes carefully, since this update may require updating listener clients or some other manual intervention. If you read release notes carefully, you can continue.',
						buttons: ['Update', 'Cancel'],
					})
					.then((v) => {
						if (v.response == 0) {
							dialog.showMessageBox(mainWindow, {
								title: 'Downloading update',
								message:
									'The update is being downloaded in the background. Once finished, you will be prompted to save your work and restart TallyArbiter.',
							})
							autoUpdater.downloadUpdate()
						}
					})
			} else {
				dialog.showMessageBox(mainWindow, {
					title: 'Downloading update',
					message:
						'The update is being downloaded in the background. Once finished, you will be prompted to save your work and restart TallyArbiter.',
				})
				autoUpdater.downloadUpdate()
			}
		})
		let releaseDate = new Date(Date.parse(info.releaseDate)).toLocaleString()
		let releaseNotesPage = `
<html>
  <head>
    <title>Release notes for version ${info.releaseName}</title>
    <style>
    .btn {
        display: inline-block;
        font-weight: 400;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        padding: .375rem .75rem;
        font-size: 1rem;
        line-height: 1.5;
        border-radius: .25rem;
        transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;
    }
    .btn-success {
        color: #fff;
        background-color: #28a745;
        border-color: #28a745;
    }
    .btn-success:hover {
        color: #fff;
        background-color: #218838;
        border-color: #1e7e34;
    }
    .btn-danger {
        color: #fff;
        background-color: #dc3545;
        border-color: #dc3545;
    }
    .btn-danger:hover {
        color: #fff;
        background-color: #c82333;
        border-color: #bd2130;
    }
    </style>
  </head>
  <body>
    <script>const { ipcRenderer } = require('electron');</script>
    <h1><b>There's an update available for TallyArbiter.</b> Do you want to download and install it?</h1>
    <button class="btn btn-success" onclick="ipcRenderer.send('updateButtonPressed')">Update</button> <button class="btn btn-danger" onclick="window.close();">Cancel</button>
    <h1>Release notes for version <b>${info.releaseName}</b>:</h1>
    ${info.releaseNotes}
    <br><br>
    <p style="font-size: x-large">Release name: <b>${info.releaseName}</b></p>
    <p style="font-size: x-large">Release date: <b>${releaseDate}</b></p>
    <p style="font-size: x-large">sha512: <b><code>${info.sha512}</code></b></p>
  </body>
</html>
        `
		releaseNotesWindow = new BrowserWindow({
			width: 850,
			height: 1260,
			minHeight: 450,
			minWidth: 450,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
			show: false,
		})
		releaseNotesWindow.setMenu(null)
		releaseNotesWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(releaseNotesPage)}`)
		releaseNotesWindow.webContents.on('did-finish-load', function () {
			releaseNotesWindow.show()
			//releaseNotesWindow.webContents.openDevTools();
		})
	})
	autoUpdater.on('update-downloaded', () => {
		dialog
			.showMessageBox(null, {
				title: 'Update downloaded',
				message: 'The update has been downloaded. Save your work and then press the Update button.',
				buttons: ['Update'],
			})
			.then((r) => {
				if (r.response == 0) {
					autoUpdater.quitAndInstall()
				}
			})
	})
}

powerMonitor.on('shutdown', () => {
	app.isQuiting = true
	app.quit()
})

if (!gotTheLock) {
	app.quit()
} else {
	app
		.whenReady()
		.then(() => {
			createWindow()
			createTrayIcon()
			checkForUpdates()
			app.on('activate', function () {
				if (BrowserWindow.getAllWindows().length === 0) createWindow()
			})
		})
		.catch((err) => {
			processError(err)
		})

	app.on('second-instance', () => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (!mainWindow.isVisible()) {
				mainWindow.show()
			}
			if (mainWindow.isMinimized()) {
				mainWindow.restore()
			}
			mainWindow.focus()
		}
	})

	app.on('window-all-closed', function () {
		if (process.platform !== 'darwin') {
			app.preventDefault() // Prevents the window from closing
			dialog
				.showMessageBox(mainWindow, {
					title: 'Are you sure?',
					message: 'Are you sure you want to quit TallyArbiter?',
					buttons: ['Yes', 'No'],
				})
				.then((v) => {
					if (v.response == 0) {
						app.quit()
					}
				})
		}
	})

	// Listen for web contents being created
	app.on('web-contents-created', (e, contents) => {
		if (contents.getType() == 'window') {
			// Listen for any new window events
			contents.on('new-window', (e, url) => {
				e.preventDefault()
				const win = new BrowserWindow({ show: false })
				win.loadURL(url)
				win.setMenu(null)
				win.webContents.on('did-finish-load', function () {
					win.show()
				})
			})
		}
	})
}
