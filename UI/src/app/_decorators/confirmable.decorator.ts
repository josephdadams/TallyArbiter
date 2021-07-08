import Swal, { SweetAlertOptions } from 'sweetalert2';


export function Confirmable(text: string) { 
    return (target: Object, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const config: SweetAlertOptions = {
            title: 'Confirmation',
            text,
            showCancelButton: true,
            confirmButtonColor: "#2a70c7",
            icon: 'question',
            focusCancel: true,
        };
        descriptor.value = async function (...args: any[]) {
            const res = await Swal.fire(config);
            if (res.isConfirmed) {
                const result = originalMethod.apply(this, args);
                return result;
            }
        };
        return descriptor;
    };
}