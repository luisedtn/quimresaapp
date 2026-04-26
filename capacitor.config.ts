import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.quimresa.colorapp',
    appName: 'Quimresa Color',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    },
    plugins: {
        BluetoothLe: {
            displayStrings: {
                scanning: 'Buscando dispositivos...',
                cancel: 'Cancelar',
                availableDevices: 'Dispositivos disponibles',
                noDeviceFound: 'No se encontraron dispositivos'
            }
        }
    }
};

export default config;
