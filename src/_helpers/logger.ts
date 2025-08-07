import findRemoveSync from 'find-remove'
import path from 'path'
import fs from 'fs'
import winston from 'winston'
import { io } from 'socket.io-client'
import { LogItem } from '../_models/LogItem'

function getLogFilePath(): string {
	var today = new Date().toISOString().replace('T', ' ').replace(/\..+/, '').replace(/:/g, '-')

	const logFolder = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + '/.local/share/'),
		'TallyArbiter/logs',
	)

	findRemoveSync(logFolder, { age: { seconds: 604800 }, extensions: '.talog', limit: 100 })

	if (!fs.existsSync(logFolder)) {
		fs.mkdirSync(logFolder, { recursive: true })
	}
	var logName = today + '.talog'
	return path.join(logFolder, logName)
}

function getTallyDataPath(): string {
	var today = new Date().toISOString().replace('T', ' ').replace(/\..+/, '').replace(/:/g, '-')

	const TallyDataFolder = path.join(
		process.env.APPDATA ||
			(process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences/' : process.env.HOME + '/.local/share/'),
		'TallyArbiter/TallyData',
	)

	findRemoveSync(TallyDataFolder, { age: { seconds: 604800 }, extensions: '.tadata', limit: 100 })

	if (!fs.existsSync(TallyDataFolder)) {
		fs.mkdirSync(TallyDataFolder, { recursive: true })
	}
	var logName = today + '.tadata'
	return path.join(TallyDataFolder, logName)
}

//Setup logger
const { combine, printf } = winston.format

export const logFilePath = getLogFilePath()
export const Logs = [] //Used for loading logs in settings page

var tallyDataFilePath = getTallyDataPath()
export const tallyDataFile = fs.openSync(tallyDataFilePath, 'w') // Setup TallyData File

const serverLoggerLevels = {
	levels: {
		critical: 0,
		error: 2,
		warning: 3,
		console_action: 4,
		info: 5,
		'info-quiet': 6,
		debug: 7,
	},
	colors: {
		critical: 'red',
		error: 'red',
		warning: 'yellow',
		console_action: 'green',
		info: 'white',
		'info-quiet': 'white',
		debug: 'blue',
	},
}
winston.addColors(serverLoggerLevels.colors)
let serverLoggerFormat = printf(({ timestamp, level, message }) => {
	if (level === 'info-quiet') {
		level = 'info'
	}
	if (level === '[37minfo-quiet[39m') {
		level = '[37minfo[39m'
	}

	return `[${timestamp}] ${level}: ${message}`
})
var serverLoggerOptions = {
	console: {
		level: 'debug',
		format: combine(
			winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
			winston.format.colorize(),
			serverLoggerFormat,
		),
	},
	file: {
		filename: logFilePath,
		maxsize: 3e6, //3MB
		maxFiles: 3,
		level: 'debug',
		format: combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), serverLoggerFormat),
	},
}
winston.loggers.add('server', {
	levels: serverLoggerLevels.levels,
	transports: [
		new winston.transports.Console(serverLoggerOptions.console),
		new winston.transports.File(serverLoggerOptions.file),
	],
})

let tallyLoggerFormat = printf((info) => {
	return `[${info.timestamp}] ${info.message}`
})
winston.loggers.add('tally', {
	format: combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss',
		}),
		tallyLoggerFormat,
	),
	transports: [
		new winston.transports.File({
			filename: tallyDataFilePath,
			maxsize: 3e6, //3MB
			maxFiles: 3,
		}),
	],
})

export const serverLogger = winston.loggers.get('server')
export const tallyLogger = winston.loggers.get('tally')
