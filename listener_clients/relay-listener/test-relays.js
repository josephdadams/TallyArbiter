/* Tally Arbiter Relay Listener -- relay diagnostics */

// Answers "did the relay actually switch?" without anyone standing next to the hardware,
// by reading each relay's state back off the board's own state register.
//
//   node test-relays.js                        cycle every relay, confirming each one
//   node test-relays.js --watch                show relay states live, as they change
//   node test-relays.js --board BITFT --relay 3  cycle just one relay
//
// --watch is safe to run while the service is running, which is the point: start a tally and
// watch the states change here.

const clc = require('cli-color')
const USBRelay = require('@josephdadams/usbrelay')

const MAX_RELAYS_PER_BOARD = 8
const WATCH_INTERVAL_MS = 250

const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(name)
const flagValue = (name) => {
	const index = args.indexOf(name)
	return index === -1 ? null : args[index + 1]
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const showState = (state) =>
	state === true ? clc.green.bold('ON ') : state === false ? clc.blackBright('off') : clc.red('? ')

function relayCountFor(board) {
	const match = /USBRelay(\d+)/i.exec(board.product || '')
	if (!match) return MAX_RELAYS_PER_BOARD
	return Math.min(parseInt(match[1], 10), MAX_RELAYS_PER_BOARD)
}

function openBoards() {
	let descriptors = []
	try {
		descriptors = USBRelay.Relays
	} catch (error) {
		console.log(clc.red.bold(`Could not enumerate USB relays: ${error.message}`))
		return []
	}

	const boards = []
	for (const descriptor of descriptors) {
		try {
			descriptor.relay = new USBRelay(descriptor.path)
			boards.push(descriptor)
		} catch (error) {
			console.log(clc.red(`Could not open ${descriptor.path}: ${error.message}`))
		}
	}
	return boards
}

function readState(board, relayNumber) {
	try {
		return board.relay.getState(relayNumber)
	} catch {
		return null //null means unreadable, which is different from off
	}
}

function readAll(board) {
	const states = []
	for (let n = 1; n <= relayCountFor(board); n++) states.push(readState(board, n))
	return states
}

function describeBoard(board) {
	return `${board.product || 'USB relay'} serial ${clc.bold(board.serial || '(none)')} at ${board.path}`
}

function printBoardStates(board) {
	const states = readAll(board)
	const cells = states.map((state, index) => `${index + 1}:${showState(state)}`)
	console.log(`  ${clc.bold((board.serial || board.path).padEnd(6))} ${cells.join('  ')}`)
}

//cycles one relay and reports whether the board confirmed the change
async function cycleRelay(board, relayNumber) {
	const before = readState(board, relayNumber)

	try {
		board.relay.setState(relayNumber, true)
	} catch (error) {
		console.log(clc.red(`  relay ${relayNumber}: could not switch on -- ${error.message}`))
		return false
	}
	const whileOn = readState(board, relayNumber)

	await sleep(700)

	try {
		board.relay.setState(relayNumber, false)
	} catch (error) {
		console.log(clc.red(`  relay ${relayNumber}: could not switch off -- ${error.message}`))
		return false
	}
	const after = readState(board, relayNumber)

	const confirmed = whileOn === true && after === false
	const verdict = confirmed ? clc.green.bold('confirmed') : clc.red.bold('NOT CONFIRMED')
	console.log(
		`  relay ${relayNumber}: ${showState(before)} -> ${showState(whileOn)} -> ${showState(after)}  ${verdict}`,
	)
	return confirmed
}

async function cycleMode(boards) {
	const onlyBoard = flagValue('--board')
	const onlyRelay = flagValue('--relay') ? Number(flagValue('--relay')) : null

	let confirmed = 0
	let attempted = 0

	for (const board of boards) {
		if (onlyBoard && board.serial !== onlyBoard) continue

		console.log('')
		console.log(describeBoard(board))
		console.log(clc.blackBright('  current state:'))
		printBoardStates(board)
		console.log(clc.blackBright('  cycling:'))

		const count = relayCountFor(board)
		for (let n = 1; n <= count; n++) {
			if (onlyRelay !== null && n !== onlyRelay) continue
			attempted++
			if (await cycleRelay(board, n)) confirmed++
		}
	}

	console.log('')
	if (attempted === 0) {
		console.log(clc.yellow('Nothing was tested. Check --board / --relay against the list above.'))
		return
	}

	if (confirmed === attempted) {
		console.log(clc.green.bold(`All ${attempted} relay(s) confirmed switching by read-back.`))
		console.log(clc.blackBright('The hardware works. If tally still does nothing, the problem is above the relay:'))
		console.log(clc.blackBright('the config mapping, the Device assignment, or the bus type.'))
	} else {
		console.log(clc.red.bold(`${confirmed} of ${attempted} relay(s) confirmed.`))
		console.log(clc.blackBright('A relay that will not confirm is usually a permissions or wiring problem.'))
	}
}

//polls every relay and prints a line whenever one changes, so a tally change is visible over SSH
async function watchMode(boards) {
	console.log('')
	console.log(clc.blue.bold('Watching relay states. Trigger a tally now. Ctrl-C to stop.'))
	console.log(clc.blackBright('This reads the boards directly, so it works while the service is running.'))
	console.log('')

	for (const board of boards) {
		console.log(describeBoard(board))
	}
	console.log('')
	console.log(clc.blackBright('Initial state:'))
	for (const board of boards) printBoardStates(board)
	console.log('')

	const previous = new Map()
	for (const board of boards) previous.set(board.path, readAll(board))

	for (;;) {
		await sleep(WATCH_INTERVAL_MS)

		for (const board of boards) {
			const now = readAll(board)
			const before = previous.get(board.path)

			for (let i = 0; i < now.length; i++) {
				if (now[i] !== before[i]) {
					const stamp = new Date().toLocaleTimeString()
					console.log(
						`[${stamp}] ${board.serial || board.path} relay ${i + 1}: ${showState(before[i])} -> ${showState(now[i])}`,
					)
				}
			}
			previous.set(board.path, now)
		}
	}
}

async function main() {
	console.log('')
	console.log(clc.blue.bold('Tally Arbiter Relay Listener -- relay diagnostics'))

	const boards = openBoards()

	if (boards.length === 0) {
		console.log('')
		console.log(clc.red.bold('No USB relay boards could be opened.'))
		console.log(clc.blackBright('If the boards are plugged in, this is almost always permissions.'))
		console.log(clc.blackBright('Try `sudo node test-relays.js`; if that works, install the udev rule'))
		console.log(clc.blackBright('(see the README) so it works without root.'))
		process.exit(1)
	}

	if (hasFlag('--watch')) {
		await watchMode(boards)
	} else {
		await cycleMode(boards)
	}
}

process.on('SIGINT', () => {
	console.log('')
	console.log(clc.blackBright('Stopped. Relay states were left as they are.'))
	process.exit(0)
})

main().catch((error) => {
	console.log(clc.red.bold(`Diagnostics failed: ${error.stack || error.message}`))
	process.exit(1)
})
