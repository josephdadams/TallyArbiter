import { NetworkInterface } from '../_models/NetworkInterface'
import os from 'os'

export function getNetworkInterfaces(): NetworkInterface[] {
	// Get all network interfaces on host device
	var interfaces = []
	const networkInterfaces = os.networkInterfaces()

	for (const networkInterface in networkInterfaces) {
		let numberOfAddresses = networkInterfaces[networkInterface].length
		let v4Addresses = []
		// Use the full OS-reported interface name as-is. Splitting on the first
		// space previously truncated distinct Windows adapters (e.g. "Ethernet",
		// "Ethernet 2", "Ethernet 3") down to the same string, causing collisions,
		// since the `${i}` suffix below only disambiguates multiple addresses
		// within the same OS-level key, not across differently-named adapters.
		let iface = networkInterface

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
