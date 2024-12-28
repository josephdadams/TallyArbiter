import Swal, { SweetAlertOptions } from 'sweetalert2'

export function Confirmable(text: string, focusCancel: boolean = true, customOptions: SweetAlertOptions = {}) {
	return (target: Object, propertyKey: string, descriptor: PropertyDescriptor) => {
		const originalMethod = descriptor.value
		const defaultConfig = {
			title: 'Confirmation',
			text: text,
			showCancelButton: true,
			confirmButtonColor: '#2a70c7',
			focusCancel: focusCancel,
		}
		const config: SweetAlertOptions = { ...defaultConfig, ...customOptions }
		descriptor.value = async function (...args: any[]) {
			const res = await Swal.fire(config)
			if (res.isConfirmed) {
				const result = originalMethod.apply(this, args)
				return result
			}
		}
		return descriptor
	}
}
