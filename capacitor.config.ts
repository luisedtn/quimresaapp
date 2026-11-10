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
        },
        SplashScreen: {
            // El splash nativo se oculta desde la app (AppIntro) en el instante
            // en que el video de intro esta listo, evitando cortar su arranque.
            launchShowDuration: 0,
            launchAutoHide: false,
            backgroundColor: "#ffffff",
            androidSplashResourceName: "splash_screen",
            androidScaleType: "FIT_CENTER",
            showSpinner: false,
            androidSpinnerStyle: "large",
            iosSpinnerStyle: "small",
            spinnerColor: "#999999",
            splashFullScreen: true,
            splashImmersive: true,
            splashFade: true,
            splashFadeDuration: 500,
        }
    }
};

export default config;
