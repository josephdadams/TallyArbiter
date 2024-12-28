import { NetworkInterface } from '../_models/NetworkInterface'
import os from 'os'

export function getNetworkInterfaces(): NetworkInterface[] {
	// Get all network interfaces on host device
	var interfaces = []
	const networkInterfaces = os.networkInterfaces()

	for (const networkInterface in networkInterfaces) {
		let numberOfAddresses = networkInterfaces[networkInterface].length
		let v4Addresses = []
		let iface = networkInterface.split(' ')[0]

		for (let i = 0; i < numberOfAddresses; i++) {
			if (networkInterfaces[networkInterface][i]['family'] === 'IPv4') {
				v4Addresses.push(networkInterfaces[networkInterface][i].address)
			}
		}
		const numV4s = v4Addresses.length
		for (let i = 0; i < numV4s; i++) {
			let aNum = numV4s > 1 ? `:${i}` : ''
			interfaces.push({
				label: `${networkInterface}${aNum}`,
				name: `${iface}${aNum}`,
				address: v4Addresses[i],
			})
		}
	}

	return interfaces
}
