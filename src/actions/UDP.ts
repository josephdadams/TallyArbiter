import { logger } from '..'
import { RegisterAction } from '../_decorators/RegisterAction'
import { Action } from './_Action'
import dgram from 'dgram'

@RegisterAction('79e3ce28', 'Generic UDP', [
	{ fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
	{ fieldName: 'port', fieldLabel: 'Port', fieldType: 'port' },
	{ fieldName: 'string', fieldLabel: 'UDP String', fieldType: 'text' },
	{
		fieldName: 'encoding',
		fieldLabel: 'Payload Encoding',
		fieldType: 'dropdown',
		options: [
			{ id: 'text', label: 'Text' },
			{ id: 'hex', label: 'Hex bytes' },
		],
		optional: true,
		help: 'Text (the default) sends the UDP String as latin1 characters. Hex bytes reads the UDP String as a list of hex byte pairs, e.g. "81 01 7E 01 0A 00 02 FF" for VISCA; spaces, commas, colons, dashes and an optional 0x prefix are allowed. The End Character is ignored for hex payloads.',
	},
	{
		fieldName: 'end',
		fieldLabel: 'End Character',
		fieldType: 'dropdown',
		options: [
			{ id: '', label: 'None' },
			{ id: '\n', label: 'LF - \\n' },
			{ id: '\r\n', label: 'CRLF - \\r\\n' },
			{ id: '\r', label: 'CR - \\r' },
			{ id: '\x00', label: 'NULL - \\x00' },
		],
		help: 'Only applies when Payload Encoding is Text. Hex byte payloads are sent exactly as typed, with nothing appended.',
	},
	{
		fieldName: 'type',
		fieldLabel: 'UDP socket family (interface type)',
		fieldType: 'dropdown',
		options: [
			{ id: 'udp4', label: 'IPv4' },
			{ id: 'udp6', label: 'IPv6' },
		],
		optional: true,
	},
])
export class UDP extends Action {
	/**
	 * Parses a user-typed hex byte string into a Buffer.
	 *
	 * Accepts the shapes people actually type when transcribing bytes out of a
	 * protocol datasheet: `81 01 7E 01 0A 00 02 FF`, `8101 7E01`, `81,01,7E,FF`,
	 * `0x81 0x01`, and any mix of upper/lower case. Whitespace and the common
	 * byte separators (comma, colon, dash) are stripped, a leading `0x` is
	 * dropped from each token, and the remaining digits must be valid hex and
	 * even in number.
	 *
	 * Returns null for malformed input so the caller can log and bail out
	 * instead of transmitting a truncated or wrong packet.
	 */
	private parseHexPayload(value: string): Buffer | null {
		if (typeof value !== 'string') return null

		const hexDigits = value
			.split(/[\s,:\-]+/)
			.filter((token) => token.length > 0)
			.map((token) => token.replace(/^0x/i, ''))
			.join('')

		if (hexDigits.length === 0) return null
		if (hexDigits.length % 2 !== 0) return null
		if (!/^[0-9a-fA-F]+$/.test(hexDigits)) return null

		return Buffer.from(hexDigits, 'hex')
	}

	public run(): void {
		try {
			// Two payload encodings exist so binary protocols (VISCA and friends) can
			// be hand-crafted without changing how any existing config behaves:
			//   - 'text' is the historical behaviour, byte for byte: unescape() the
			//     UDP String (legacy %xx / %uXXXX decoding), append the End
			//     Character, encode as latin1. There is no way to express a raw byte
			//     such as 0x81 this way, which is why 'hex' was added.
			//   - 'hex' reads the UDP String as raw bytes and sends them verbatim.
			// Backwards compatibility: device actions saved before this field existed
			// have no `encoding` key at all, so a missing (or empty) value must be
			// treated as 'text'.
			const encoding = this.action.data.encoding || 'text'

			let sendBuf: Buffer
			if (encoding === 'hex') {
				const parsed = this.parseHexPayload(this.action.data.string)
				if (parsed === null) {
					logger(
						`An error occured sending the Generic UDP: Payload Encoding is "Hex bytes" but the UDP String "${this.action.data.string}" is not a valid sequence of hex byte pairs. Use pairs of hex digits, e.g. 81 01 7E 01 0A 00 02 FF`,
						'error',
					)
					return
				}
				// The End Character is deliberately ignored for hex payloads: a binary
				// packet is fully described by its bytes, and silently appending a
				// LF/CR/NULL would corrupt protocols like VISCA, which carry their own
				// terminator (0xFF). Anyone who needs a trailing byte can just type it.
				sendBuf = parsed
			} else {
				sendBuf = Buffer.from(unescape(this.action.data.string) + this.action.data.end, 'latin1')
			}

			if (!this.action.data.type) this.action.data.type = 'udp4'
			let client = dgram.createSocket(this.action.data.type)
			client.on('error', (err) => {
				logger(`An error occured sending the Generic UDP: ${err}`, 'error')
			})

			client.send(Uint8Array.from(sendBuf), this.action.data.port, this.action.data.ip, (error) => {
				if (!error) {
					logger(
						`Generic UDP sent: ${this.action.data.ip}:${this.action.data.port} : ${this.action.data.string}`,
						'info',
					)
				}
				client.close()
			})
		} catch (error) {
			logger(`An error occured sending the Generic UDP: ${error}`, 'error')
		}
	}
}
