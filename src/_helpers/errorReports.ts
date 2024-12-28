import path from 'path'
import fs from 'fs-extra'
import { ErrorReportsListElement } from '../_models/ErrorReportsListElement'
import { ErrorReport } from '../_models/ErrorReport'
import { logger, logFilePath, getConfigRedacted } from '..'
import { uuidv4 } from './uuid'

export function getErrorReportsList(): ErrorReportsListElement[] {
	try {
		const ErrorReportsFolder = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/ErrorReports',
		)
		const ErrorReportsFiles = fs.readdirSync(ErrorReportsFolder)
		let errorReports = []
		ErrorReportsFiles.forEach((file) => {
			let currentErrorReport = JSON.parse(fs.readFileSync(path.join(ErrorReportsFolder, file), 'utf8'))
			let reportId = file.replace(/\.[^/.]+$/, '')
			errorReports.push({ id: reportId, datetime: currentErrorReport.datetime })
		})
		return errorReports
	} catch (e) {
		return []
	}
}

export function getReadErrorReports(): string[] {
	try {
		const readErrorReportsFilePath = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/readErrorReports.json',
		)
		return JSON.parse(fs.readFileSync(readErrorReportsFilePath, 'utf8'))
	} catch (e) {
		return []
	}
}

export function markErrorReportAsRead(errorReportId: string): boolean {
	try {
		const readErrorReportsFilePath = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/readErrorReports.json',
		)
		let readErrorReportsList = getReadErrorReports()
		readErrorReportsList.push(errorReportId)
		fs.writeFileSync(readErrorReportsFilePath, JSON.stringify(readErrorReportsList))
		return true
	} catch (e) {
		return false
	}
}

export function getUnreadErrorReportsList(): ErrorReportsListElement[] {
	let errorReports = getErrorReportsList()
	let readErrorReports = getReadErrorReports()
	return errorReports.filter((report) => {
		return !readErrorReports.includes(report.id)
	})
}

export function getErrorReport(reportId: string): ErrorReport | false {
	try {
		if (!reportId.match(/^[a-zA-Z0-9]+$/i)) return false
		const ErrorReportsFolder = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/ErrorReports',
		)
		const ErrorReportFile = path.join(ErrorReportsFolder, reportId + '.json')
		return JSON.parse(fs.readFileSync(ErrorReportFile, 'utf8'))
	} catch (e) {
		return false
	}
}

export function getErrorReportPath(id: string): string {
	const ErrorReportsFolder = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + '/.local/share/'),
		'TallyArbiter/ErrorReports',
	)

	if (!fs.existsSync(ErrorReportsFolder)) {
		fs.mkdirSync(ErrorReportsFolder, { recursive: true })
	}
	var errorReportName = id + '.json'
	return path.join(ErrorReportsFolder, errorReportName)
}

export function generateErrorReport(error: Error) {
	logger(`Caught exception: ${error}`, 'error')
	console.trace(error)
	let id = uuidv4()
	let stacktrace = 'No stacktrace captured.'
	if (error !== undefined) {
		stacktrace = error.stack
	}
	let logs = ''
	try {
		logs = fs.readFileSync(logFilePath, 'utf8')
	} catch (e) {}
	var errorReport = {
		datetime: new Date(),
		stacktrace: stacktrace,
		logs: logs,
		config: getConfigRedacted(),
	}
	fs.writeFileSync(getErrorReportPath(id), JSON.stringify(errorReport))
	return id
}

export function markErrorReportsAsRead() {
	try {
		const ErrorReportsFolder = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/ErrorReports',
		)
		const ErrorReportsFiles = fs.readdirSync(ErrorReportsFolder).map((file) => {
			return file.replace(/\.[^/.]+$/, '')
		})
		const readErrorReportsFilePath = path.join(
			process.env.APPDATA ||
				(process.platform == 'darwin'
					? process.env.HOME + '/Library/Preferences/'
					: process.env.HOME + '/.local/share/'),
			'TallyArbiter/readErrorReports.json',
		)
		fs.writeFileSync(readErrorReportsFilePath, JSON.stringify(ErrorReportsFiles))
		return true
	} catch (e) {
		return false
	}
}

export function deleteEveryErrorReport() {
	const ErrorReportsFolder = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + '/.local/share/'),
		'TallyArbiter/ErrorReports',
	)
	fs.emptyDirSync(ErrorReportsFolder)
	const readErrorReportsFilePath = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + '/.local/share/'),
		'TallyArbiter/readErrorReports.json',
	)
	fs.writeFileSync(readErrorReportsFilePath, '[]')
}
