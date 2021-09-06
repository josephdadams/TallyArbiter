export interface Manage {
    type: 'source' | 'device' | 'device_source' | 'device_action' | 'tsl_client' | 'bus_option' | 'cloud_destination' | 'cloud_key' | 'cloud_client';
    action: 'add' | 'edit' | 'delete' | 'remove';
}