import { logger } from '..'
import { RegisterTallyInput } from '../_decorators/RegisterTallyInput.decorator'
import { Source } from '../_models/Source'
import { TallyInput } from './_Source'
import { Buffer } from 'buffer'
import net from 'net'

/**
 * Connection setup for DVIP switchers:
 * 1. Connect to control port (5009) to negotiate the realtime port.
 * 2. Send handshake packet: [0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0xaa, 0x55]
 * 3. Receive response with the realtime port at offset 4 (little-endian).
 * 4. Connect to the realtime port and start receiving updates.
 */

@RegisterTallyInput('e7a3f2c1', 'DataVideo IP (DVIP)', 'Models supported: SE-650, SE-700, SE-1200MU/HS-1300', [
    { fieldName: 'ip', fieldLabel: 'IP Address', fieldType: 'text' },
    { fieldName: 'port', fieldLabel: 'Realtime Port (0 for autodetect)', fieldType: 'port', optional: true },
], [
    { bus: 'key1', name: 'Key 1' },
    { bus: 'key2', name: 'Key 2' },
    { bus: 'dsk1', name: 'DSK 1' },
    { bus: 'dsk2', name: 'DSK 2' },
])

export class DataVideoIP extends TallyInput {
    private socket_realtime?: net.Socket
    private socket_request?: net.Socket

    private null_packet = Buffer.from([0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    private filter_packets = [
        Buffer.from([0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]),
        Buffer.from([0x08, 0x00, 0x00, 0x00, 0x30, 0x4e, 0x13, 0x00])  // filter_packet
    ]

    private realtime_port?: number

    constructor(source: Source) {
        super(source)

        const INPUT_IDS: { [key: number]: string } = {
            1: 'In 1',
            2: 'In 2',
            3: 'In 3',
            4: 'In 4',
            5: 'In 5',
            6: 'In 6',
        };

        // Pre-populate addresses with common inputs
        for (const [id, label] of Object.entries(INPUT_IDS)) {
            this.addAddress(label, id.toString());
        }

        this.initTCP()
    }

    /**
     * Initializes TCP connections for DataVideo IP.
     * If a realtime port is configured, connects directly; otherwise, negotiates the port.
     * Cleans up any previous sockets before reconnecting.
     */
    private initTCP() {
        // Clean up any existing sockets before (re)connecting
        if (this.socket_realtime) {
            this.socket_realtime.destroy()
            delete this.socket_realtime
        }
        if (this.socket_request) {
            this.socket_request.destroy()
            delete this.socket_request
        }

        // Use configured port if present, otherwise negotiate
        if (this.source.data.port !== 0) {
            this.realtime_port = this.source.data.port
            this.setupConnection()
        } else {
            this.requestPort()
        }
    }

    /**
     * Requests the realtime port from the device's control port (5009).
     * On success, sets the internal realtime_port and connects.
     * On failure or invalid port, triggers a reconnect.
     */
    private requestPort() {
        let port_realtime: number

        this.socket_request = new net.Socket()

        this.socket_request.on('error', (err) => {
            logger(`DataVideoIP: Network error: ${err.message}`, 'error')
        })

        this.socket_request.connect(5009, this.source.data.ip, () => {
            logger('DataVideoIP: Connected to DVIP port 5009', 'info')
            // Send handshake/request packet to negotiate realtime port
            this.socket_request?.write(Buffer.from([0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0xaa, 0x55]))
        })

        this.socket_request.on('data', (buffer: Buffer) => {
            // Expecting 8-byte response with port in offset 4 (little-endian)
            if (buffer.length === 8) {
                port_realtime = buffer.readInt16LE(4)
                logger(`DataVideoIP: Available Realtime Port: ${port_realtime}`, 'info')
                if ([5001, 5003, 5005, 5007].includes(port_realtime)) {
                    this.realtime_port = port_realtime
                    this.socket_request?.destroy()
                    delete this.socket_request

                    this.setupConnection()
                } else {
                    this.reconnect()
                }
            } else {
                this.reconnect()
            }
        })
    }

    /**
     * Establishes the realtime connection using the negotiated or configured port.
     * Sets up listeners for data and error events.
     */
    private setupConnection() {
        this.socket_realtime = new net.Socket()

        this.socket_realtime.on('error', (err) => {
            logger('DataVideoIP: Realtime network error: ' + err.message, 'error')
            this.connected.next(false)
        })

        this.socket_realtime.on('close', (hadError) => {
            logger(`DataVideoIP: Realtime connection closed${hadError ? ' due to error' : ''}`, 'error')
            this.connected.next(false)
        })

        this.socket_realtime.connect(this.realtime_port, this.source.data.ip, () => {
            logger('DataVideoIP: Connected to DVIP realtime port', 'info')
            // Send initial null packet to start communication
            this.socket_realtime?.write(this.null_packet)
            this.connected.next(true)
        })

        this.socket_realtime.on('data', (buffer: Buffer) => {
            // Always respond with a null packet to keep the connection alive
            if (this.socket_realtime?.writable) {
                this.socket_realtime?.write(this.null_packet)
            }

            if (
                !buffer.equals(this.null_packet) &&
                !this.filter_packets.some(pkt => buffer.equals(pkt))
            ) {
                this.processBuffer(buffer)
            }
        })
    }

    /**
     * Reconnects by cleaning up and re-initializing TCP connections after a short delay.
     * If the reconnection happens to fast, the vision mixer may crash
     */
    public reconnect(): void {
        this.exit()
        setTimeout(() => this.initTCP(), 500)
    }

    /**
     * Cleans up all sockets and resets connection state.
     * Ensures sockets are destroyed after ending.
     */
    public exit(): void {
        super.exit()
        if (this.socket_realtime) {
            this.socket_realtime.end()
            setTimeout(() => this.socket_realtime?.destroy(), 100)
        }
        if (this.socket_request) {
            this.socket_request.end()
            setTimeout(() => this.socket_request?.destroy(), 100)
        }
    }

    /**
     * Processes incoming data buffer from the device.
     * Only handles buffers with valid command IDs and parses all 8-byte blocks after the header.
     * Each block may represent a control update; only bus updates (SECTION_SWITCHER, sectionID 2)
     * for known control IDs are processed and mapped to tally busses.
     * Other data in the buffer is ignored.
     */
    processBuffer(buffer: Buffer) {
        // logger(`DataVideoIP: Received buffer: ${buffer.toString('hex')}`, 'info-quiet');

        // Parse command ID (little-endian, offset 4)
        const commandId = buffer.readInt32LE(4);

        // Only process if commandId is 0 or 1265200 (GET_CONTROL)
        if (commandId !== 0 && commandId !== 1265200) {
            return;
        }

        // Map control IDs to bus names for direct lookup
        const CONTROL_ID_TO_BUS: { [id: number]: string } = {
            86: 'program',
            87: 'preview',
            20: 'key1',
            50: 'key2',
            92: 'dsk1',
            110: 'dsk2',
        };

        // Process each 8-byte block after the 8-byte header
        for (let i = 8; i + 8 <= buffer.length; i += 8) {
            const block = buffer.slice(i, i + 8);
            const controlID = block.readUInt8(0);
            const sectionID = block.readUInt16LE(2);
            const value = block.readInt32LE(4);

            // Only process SECTION_SWITCHER, which contains the bus updates
            if (sectionID !== 2) {
                continue;
            }

            // Map the control ID to the corresponding bus
            const bus = CONTROL_ID_TO_BUS[controlID];

            if (bus) {
                this.handleTallyChange(bus, value);
            }
        }
    }

    // Update tally state and emit tally event if changed
    private handleTallyChange(bus: string, input: number) {
        // A bus can only have a single active source
        this.removeBusFromAllAddresses(bus);

        this.addBusToAddress(input.toString(), bus);
        this.sendTallyData();

        logger(`DataVideoIP: Tally changed for ${bus} to input ${input}`, 'info-quiet');
    }
}
