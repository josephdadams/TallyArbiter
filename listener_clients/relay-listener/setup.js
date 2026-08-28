/* Tally Arbiter Relay Listener -- interactive configuration */

// Builds config_relays.json by asking questions instead of making the user hand-write
// JSON and copy device ids out of the Tally Arbiter web interface.

const fs = require('fs')
const readline = require('node:readline/promises')
const clc = require('cli-color')
const io = require('socket.io-client')
const { Bonjour } = require('bonjour-service')
const { v4: uuidv4 } = require('uuid')
const USBRelay = require('@josephdadams/usbrelay')

const config_file = './config_relays.json'
const MAX_RELAYS_PER_BOARD = 8 //the USBRelay protocol addresses at most 8 relays
const MDNS_TIMEOUT_MS = 5000
const SERVER_TIMEOUT_MS = 8000

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function heading(text) {
	console.log('')
	console.log(clc.blue.bold(text))
	console.log(clc.blackBright('-'.repeat(text.length)))
}

function note(text) {
	console.log(clc.blackBright(text))
}

function warn(text) {
	console.log(clc.yellow(text))
}

function fail(text) {
	console.log(clc.red.bold(text))
}

//asks a question, re-asking until the answer passes validate()
async function ask(question, { defaultValue, validate } = {}) {
	for (;;) {
		const suffix = defaultValue === undefined ? '' : clc.blackBright(` [${defaultValue}]`)
		const answer = (await rl.question(`${question}${suffix}: `)).trim()
		const value = answer === '' && defaultValue !== undefined ? String(defaultValue) : answer

		if (value === '') {
			warn('  Please enter a value.')
			continue
		}
		if (validate) {
			const problem = validate(value)
			if (problem) {
				warn(`  ${problem}`)
				continue
			}
		}
		return value
	}
}

async function askYesNo(question, defaultYes = true) {
	const answer = await ask(`${question} (y/n)`, {
		defaultValue: defaultYes ? 'y' : 'n',
		validate: (v) => (/^[yn]/i.test(v) ? null : 'Please answer y or n.'),
	})
	return /^y/i.test(answer)
}

//presents a numbered list and returns the chosen item
async function askChoice(question, choices, { allowSkip } = {}) {
	choices.forEach((choice, index) => {
		console.log(`  ${clc.bold(index + 1)}) ${choice.label}`)
	})
	if (allowSkip) {
		console.log(`  ${clc.bold('0')}) ${allowSkip}`)
	}

	const answer = await ask(question, {
		validate: (v) => {
			const n = Number(v)
			if (!Number.isInteger(n)) return 'Enter the number next to your choice.'
			if (allowSkip && n === 0) return null
			if (n < 1 || n > choices.length) return `Enter a number between 1 and ${choices.length}.`
			return null
		},
	})

	const n = Number(answer)
	return n === 0 ? null : choices[n - 1].value
}

//the board reports its channel count in the product string, ex. "USBRelay8"
function relayCountFor(board) {
	const match = /USBRelay(\d+)/i.exec(board.product || '')
	if (!match) return null
	return Math.min(parseInt(match[1], 10), MAX_RELAYS_PER_BOARD)
}

function describeBoard(board) {
	const count = relayCountFor(board)
	const channels = count === null ? 'unknown channel count' : `${count} channels`
	return `${board.product || 'USB relay'} -- serial ${clc.bold(board.serial)} (${channels}, ${board.path})`
}

function detectBoards() {
	let boards = []
	try {
		boards = USBRelay.Relays
	} catch (error) {
		fail(`Could not enumerate USB relays: ${error.message}`)
		return []
	}

	//attach a live handle so the test feature can actually switch a relay
	return boards.filter((board) => {
		try {
			board.relay = new USBRelay(board.path)
			return true
		} catch (error) {
			warn(`  Skipping ${board.path}: ${error.message}`)
			return false
		}
	})
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

//pulses a relay so the user can hear/see which physical channel they are configuring
async function testRelay(board, relayNumber) {
	try {
		board.relay.setState(relayNumber, true)
		await sleep(600)
		board.relay.setState(relayNumber, false)
		note(`  Pulsed relay ${relayNumber} on ${board.serial}.`)
	} catch (error) {
		fail(`  Could not switch relay ${relayNumber}: ${error.message}`)
	}
}

function turnAllOff(boards) {
	for (const board of boards) {
		try {
			board.relay.setState(0, false) //relay 0 is the "all relays" address
		} catch {
			//a board that will not switch here is already reported elsewhere
		}
	}
}

//finds Tally Arbiter servers advertising themselves over mDNS
function discoverServers() {
	return new Promise((resolve) => {
		const bonjour = new Bonjour()
		const found = []

		const browser = bonjour.find({ type: 'tally-arbiter' }, (service) => {
			if (!found.some((s) => s.host === service.host && s.port === service.port)) {
				found.push(service)
				note(`  Found ${service.host}:${service.port}${service.txt?.version ? ` (v${service.txt.version})` : ''}`)
			}
		})

		setTimeout(() => {
			browser.stop()
			bonjour.destroy()
			resolve(found)
		}, MDNS_TIMEOUT_MS)
	})
}

process.on('SIGINT', () => {
	console.log('')
	note('Setup cancelled. No changes were written.')
	process.exit(0)
})

//connects just long enough to read the Devices and bus options the server knows about
function fetchServerInfo(ip, port) {
	return new Promise((resolve) => {
		const socket = io.connect(`http://${ip}:${port}`, {
			reconnection: false,
			timeout: SERVER_TIMEOUT_MS,
		})

		const result = { devices: null, busOptions: null, error: null }
		let settled = false

		function finish(error) {
			if (settled) return
			settled = true
			clearTimeout(timer)
			result.error = error || null
			socket.close()
			resolve(result)
		}

		const timer = setTimeout(() => {
			if (result.devices) return finish(null) //got what we needed, just no bus options yet
			finish(`No response from ${ip}:${port} after ${SERVER_TIMEOUT_MS / 1000} seconds.`)
		}, SERVER_TIMEOUT_MS)

		socket.on('connect_error', (error) => finish(`Could not connect to ${ip}:${port}: ${error.message}`))
		socket.on('error', (error) => finish(`Server error: ${error}`))

		//both are request/response: the server only sends these when asked. Deliberately not using
		//listenerclient_connect, which would register this script as a real listener client and can
		//reassign devices as a side effect.
		socket.on('connect', () => {
			socket.emit('devices')
			socket.emit('bus_options')
		})

		socket.on('devices', (devices) => {
			result.devices = devices
			if (result.busOptions) finish(null)
		})

		socket.on('bus_options', (busOptions) => {
			result.busOptions = busOptions
			if (result.devices) finish(null)
		})
	})
}

//asks for the server, then reads back its Devices so the user picks names instead of ids
async function configureServer() {
	heading('Step 2 of 4: Tally Arbiter server')

	let ip
	let port
	let useMDNS = false

	if (await askYesNo('Search the network for a Tally Arbiter server automatically?')) {
		note(`  Searching for ${MDNS_TIMEOUT_MS / 1000} seconds...`)
		const servers = await discoverServers()

		if (servers.length > 0) {
			const chosen = await askChoice(
				'Which server?',
				servers.map((s) => ({
					label: `${s.host}:${s.port}${s.txt?.version ? ` (v${s.txt.version})` : ''}`,
					value: s,
				})),
				{ allowSkip: 'Enter an address manually instead' },
			)
			if (chosen) {
				ip = chosen.host
				port = chosen.port
				useMDNS = true
			}
		} else {
			warn('  No servers found. You can enter the address manually.')
		}
	}

	if (!ip) {
		ip = await ask('Tally Arbiter server IP address or hostname', { defaultValue: 'localhost' })
		port = Number(
			await ask('Port', {
				defaultValue: 4455,
				validate: (v) =>
					Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 65536
						? null
						: 'Enter a port number between 1 and 65535.',
			}),
		)
	}

	note(`  Connecting to ${ip}:${port}...`)
	const info = await fetchServerInfo(ip, port)

	if (info.error) {
		fail(`  ${info.error}`)
		warn('  Continuing without the device list -- you will need to enter Device ids by hand.')
		warn('  You can re-run this setup once the server is reachable.')
	} else {
		note(`  Connected. Found ${info.devices.length} device(s) and ${info.busOptions?.length ?? 0} bus type(s).`)
	}

	return { server_config: { ip, port, useMDNS }, devices: info.devices, busOptions: info.busOptions }
}

//bus types come from the server when we could reach it, since index.js matches on bus_options[].type
function busTypeChoices(busOptions) {
	if (busOptions && busOptions.length > 0) {
		//one entry per distinct type: index.js matches on bus_options[].type, while label is what
		//the operator recognises from the web interface
		const seen = new Set()
		const choices = []
		for (const bus of busOptions) {
			if (!bus.type || seen.has(bus.type)) continue
			seen.add(bus.type)
			choices.push({ label: `${bus.label || bus.type} ${clc.blackBright(`(${bus.type})`)}`, value: bus.type })
		}
		if (choices.length > 0) return choices
	}
	return [
		{ label: 'program', value: 'program' },
		{ label: 'preview', value: 'preview' },
	]
}

//picks the Tally Arbiter Device a relay group follows
async function chooseDevice(devices, groupNumber) {
	if (devices && devices.length > 0) {
		const chosen = await askChoice(
			`Which Tally Arbiter Device should relay group ${groupNumber} follow?`,
			devices.map((d) => ({
				label: `${d.name} ${clc.blackBright(`(${d.id})`)}${d.enabled === false ? clc.yellow(' [disabled]') : ''}`,
				value: d.id,
			})),
		)
		return chosen
	}

	return await ask(`Device id for relay group ${groupNumber}`, {
		validate: (v) =>
			/^[0-9a-f]{4,}$/i.test(v)
				? null
				: 'Device ids look like "a90687c3". Copy one from the Tally Arbiter web interface.',
	})
}

//picks a board, or takes a serial by hand when nothing was detected. Returns an object with at
//least a serial; `relay` is only present when we can actually switch the hardware.
async function chooseBoard(boards) {
	if (boards.length === 1) return boards[0]

	if (boards.length > 1) {
		return await askChoice(
			'Which relay board?',
			boards.map((b) => ({ label: describeBoard(b), value: b })),
		)
	}

	const serial = await ask('Relay board serial number', {
		validate: (v) => (v.length <= 5 ? null : 'Serials from these boards are 5 characters, ex. "BITFT".'),
	})
	return { serial, relay: null }
}

//walks one relay group: the device it follows, then each relay assigned to it
async function configureRelayGroup(groupNumber, boards, devices, busOptions) {
	heading(`Relay group ${groupNumber}`)

	const deviceId = await chooseDevice(devices, groupNumber)
	const relays = []

	for (;;) {
		const board = await chooseBoard(boards)

		const maxRelay = relayCountFor(board) ?? MAX_RELAYS_PER_BOARD
		const relayNumber = Number(
			await ask(`Which relay number on ${board.serial}? (1-${maxRelay})`, {
				validate: (v) => {
					const n = Number(v)
					if (!Number.isInteger(n) || n < 1 || n > maxRelay) return `Enter a relay number between 1 and ${maxRelay}.`
					if (relays.some((r) => r.relaySerial === board.serial && r.relayNumber === n))
						return 'That relay is already in this group.'
					return null
				},
			}),
		)

		//only offer the pulse when we hold a live handle to the board
		if (board.relay && (await askYesNo(`Pulse relay ${relayNumber} now so you can confirm which one it is?`))) {
			await testRelay(board, relayNumber)
		}

		const busType = await askChoice('Which bus should switch this relay on?', busTypeChoices(busOptions))

		relays.push({ relaySerial: board.serial, relayNumber, busType })
		note(`  Added ${board.serial} relay ${relayNumber} on ${busType}.`)

		if (!(await askYesNo('Add another relay to this group?', false))) break
	}

	return { id: String(groupNumber), relays, deviceId }
}

const UDEV_RULE_PATH = '/etc/udev/rules.d/99-usbrelay.rules'
const SERVICE_NAME = 'tallyarbiter-relay'
const UNIT_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`

const toHex4 = (n) => Number(n).toString(16).padStart(4, '0')

//builds the rule from the hardware we actually found, rather than assuming a vendor/product id
function buildUdevRule(boards) {
	const pairs = []
	for (const board of boards) {
		const key = `${toHex4(board.vendorId)}:${toHex4(board.productId)}`
		if (!pairs.includes(key)) pairs.push(key)
	}

	const lines = [
		'# Tally Arbiter Relay Listener -- generated by `npm run setup`',
		'# Lets the relay listener reach the USB relay without running as root.',
	]
	for (const pair of pairs) {
		const [vendor, product] = pair.split(':')
		//the usb rule covers the libusb backend, the hidraw rule the hidraw backend that
		//node-hid uses by default on Linux
		lines.push(
			`SUBSYSTEM=="usb", ATTRS{idVendor}=="${vendor}", ATTRS{idProduct}=="${product}", MODE="0660", GROUP="plugdev"`,
		)
		lines.push(
			`KERNEL=="hidraw*", ATTRS{idVendor}=="${vendor}", ATTRS{idProduct}=="${product}", MODE="0660", GROUP="plugdev"`,
		)
	}
	return lines.join('\n') + '\n'
}

function buildUnitFile({ user, workingDirectory, nodePath }) {
	//a node installed under /home (nvm, fnm, asdf) is unreachable with ProtectHome=true
	const nodeInHome = nodePath.startsWith('/home/') || nodePath.startsWith('/root/')

	const lines = [
		'[Unit]',
		'Description=Tally Arbiter Relay Listener',
		'After=network-online.target',
		'Wants=network-online.target',
		'',
		'[Service]',
		'Type=simple',
		`User=${user}`,
		'SupplementaryGroups=plugdev',
		//required: index.js reads ./config_relays.json relative to the cwd and rewrites it
		`WorkingDirectory=${workingDirectory}`,
		`ExecStart=${nodePath} index.js`,
		'Restart=always',
		'RestartSec=5',
		'TimeoutStopSec=10',
		'StandardOutput=journal',
		'StandardError=journal',
		'NoNewPrivileges=true',
		//ProtectSystem=full rather than strict, so the clientUUID write to config_relays.json works
		'ProtectSystem=full',
		nodeInHome ? '# ProtectHome left off: node lives under a home directory' : 'ProtectHome=true',
		'PrivateTmp=true',
		'',
		'[Install]',
		'WantedBy=multi-user.target',
		'',
	]
	return lines.join('\n')
}

//runs a privileged command, escalating with sudo only when we are not already root
function runPrivileged(command, args) {
	const { spawnSync } = require('child_process')
	const asRoot = typeof process.getuid === 'function' && process.getuid() === 0
	const bin = asRoot ? command : 'sudo'
	const argv = asRoot ? args : [command, ...args]

	const result = spawnSync(bin, argv, { stdio: 'inherit' })
	if (result.error) return `${command}: ${result.error.message}`
	if (result.status !== 0) return `${command} exited with code ${result.status}`
	return null
}

//writes a root-owned file via tee, so the whole flow needs only one sudo prompt path
function writePrivilegedFile(path, contents) {
	const { spawnSync } = require('child_process')
	const asRoot = typeof process.getuid === 'function' && process.getuid() === 0
	const bin = asRoot ? 'tee' : 'sudo'
	const argv = asRoot ? [path] : ['tee', path]

	const result = spawnSync(bin, argv, { input: contents, stdio: ['pipe', 'ignore', 'inherit'] })
	if (result.error) return `Could not write ${path}: ${result.error.message}`
	if (result.status !== 0) return `Could not write ${path} (exit code ${result.status})`
	return null
}

//offers to install the udev rule and the systemd service, showing everything before it runs
async function installService(boards) {
	heading('Step 4 of 4: Run as a service (optional)')

	if (process.platform !== 'linux') {
		note(`  Skipped: this step needs systemd, and this machine is ${process.platform}.`)
		return
	}

	if (!(await askYesNo('Set up the udev rule and systemd service now?'))) {
		note('  Skipped. See the README for the manual steps.')
		return
	}

	const user = process.env.SUDO_USER || process.env.USER || 'pi'
	const workingDirectory = process.cwd()
	const nodePath = process.execPath

	const udevRule = boards.length > 0 ? buildUdevRule(boards) : null
	const unitFile = buildUnitFile({ user, workingDirectory, nodePath })

	console.log('')
	if (udevRule) {
		note(`This will write ${UDEV_RULE_PATH}:`)
		console.log(clc.blackBright(udevRule.replace(/^/gm, '    ')))
	} else {
		warn('No relay boards were detected, so no udev rule can be generated for your hardware.')
		warn('Plug in the relay and re-run setup if you need the rule.')
	}

	note(`This will write ${UNIT_PATH}:`)
	console.log(clc.blackBright(unitFile.replace(/^/gm, '    ')))

	note('It will then run:')
	if (udevRule) note('    udevadm control --reload-rules && udevadm trigger')
	note(`    usermod -aG plugdev ${user}`)
	note('    systemctl daemon-reload')
	note(`    systemctl enable --now ${SERVICE_NAME}`)
	console.log('')
	note('You will be asked for your password, since these need root.')
	console.log('')

	if (!(await askYesNo('Go ahead?', false))) {
		note('  Skipped. Nothing was written.')
		return
	}

	const problems = []

	if (udevRule) {
		problems.push(writePrivilegedFile(UDEV_RULE_PATH, udevRule))
		problems.push(runPrivileged('udevadm', ['control', '--reload-rules']))
		problems.push(runPrivileged('udevadm', ['trigger']))
	}

	//the service user needs plugdev to open the relay through the rule above
	problems.push(runPrivileged('usermod', ['-aG', 'plugdev', user]))

	problems.push(writePrivilegedFile(UNIT_PATH, unitFile))
	problems.push(runPrivileged('systemctl', ['daemon-reload']))
	problems.push(runPrivileged('systemctl', ['enable', '--now', SERVICE_NAME]))

	const failures = problems.filter(Boolean)
	if (failures.length > 0) {
		console.log('')
		fail('Some steps did not complete:')
		for (const failure of failures) fail(`  ${failure}`)
		note('Fix the cause and re-run setup, or follow the manual steps in the README.')
		return
	}

	console.log('')
	note('Service installed and started. Useful commands:')
	console.log(`    journalctl -u ${SERVICE_NAME} -f`)
	console.log(`    sudo systemctl restart ${SERVICE_NAME}`)
	console.log(`    sudo systemctl status ${SERVICE_NAME}`)
	warn(`If the relay is not reachable, log out and back in so the plugdev group applies to ${user}.`)
}

function writeConfig(config) {
	if (fs.existsSync(config_file)) {
		const backup = `${config_file}.backup-${Date.now()}`
		fs.copyFileSync(config_file, backup)
		note(`  Existing config backed up to ${backup}`)
	}
	fs.writeFileSync(config_file, JSON.stringify(config, null, '\t') + '\n')
}

async function main() {
	console.log('')
	console.log(clc.blue.bold('Tally Arbiter Relay Listener setup'))
	note('This builds config_relays.json by asking a few questions. Ctrl-C to cancel at any point.')

	heading('Step 1 of 4: USB relay boards')
	const boards = detectBoards()

	if (boards.length === 0) {
		fail('No USB relay boards were detected.')
		note('Check that the relay is plugged in, and that you have permission to read it.')
		note('On Linux you may need the udev rule described in the README, or run setup with sudo.')
		if (!(await askYesNo('Carry on anyway and enter relay serial numbers by hand?', false))) {
			rl.close()
			return
		}
	} else {
		for (const board of boards) note(`  ${describeBoard(board)}`)
	}

	const { server_config, devices, busOptions } = await configureServer()

	heading('Step 3 of 4: Relay groups')
	note('A relay group ties one Tally Arbiter Device to one or more relays.')

	const relay_groups = []
	for (;;) {
		relay_groups.push(await configureRelayGroup(relay_groups.length + 1, boards, devices, busOptions))
		if (!(await askYesNo('Add another relay group?', false))) break
	}

	turnAllOff(boards)

	//preserve the existing clientUUID so the server keeps recognising this listener
	let clientUUID = uuidv4()
	if (fs.existsSync(config_file)) {
		try {
			const existing = JSON.parse(fs.readFileSync(config_file))
			if (existing.clientUUID) clientUUID = existing.clientUUID
		} catch {
			//an unreadable existing config is replaced, and backed up first
		}
	}

	const config = { server_config, relay_groups, clientUUID }

	console.log('')
	note('Configuration to be written:')
	console.log(clc.blackBright(JSON.stringify(config, null, '\t').replace(/^/gm, '    ')))

	if (!(await askYesNo(`Write this to ${config_file}?`))) {
		note('Nothing was written.')
		rl.close()
		return
	}

	writeConfig(config)
	note(`  Wrote ${config_file}`)

	await installService(boards)

	console.log('')
	console.log(clc.green.bold('Setup complete.'))
	rl.close()
}

main().catch((error) => {
	fail(`Setup failed: ${error.stack || error.message}`)
	rl.close()
	process.exit(1)
})
