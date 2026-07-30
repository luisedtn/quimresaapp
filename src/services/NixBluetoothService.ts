/**
 * NixBluetoothService.ts
 * Bridge DUAL para comunicar dispositivos Nix Colorímetros/Espectrofotómetros.
 * 
 * - En NAVEGADOR DE ESCRITORIO: usa Web Bluetooth API
 * - En ANDROID (Capacitor): usa @capacitor-community/bluetooth-le
 * 
 * Basado en el análisis del SDK Nix Universal v4.2.1 para Android.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// Definir el plugin personalizado para TypeScript
interface NixSensorPlugin {
    startScan(): Promise<void>;
    stopScan(): Promise<void>;
    connect(options: { id: string }): Promise<NixDeviceInfo>;
    disconnect(): Promise<void>;
    measure(options?: { mode?: string; referenceWhite?: string }): Promise<{ color: NixColorData }>;
    addListener(eventName: string, listenerFunc: (data: any) => void): any;
}

export interface DiscoveredDevice {
    id: string;
    name: string;
    rssi: number;
    type?: string;
}

const NixSensor = registerPlugin<NixSensorPlugin>('NixSensorPlugin');

// ============================================================
// INTERFACES DE DATOS DE COLOR
// ============================================================

export interface NixColorData {
    L: number;   // CIE L* (0-100)
    a: number;   // CIE a* (-128 to 127)
    b: number;   // CIE b* (-128 to 127)
    R: number;   // sRGB Red (0-255)
    G: number;   // sRGB Green (0-255)
    B: number;   // sRGB Blue (0-255)
    C: number;   // Chroma
    H: number;   // Hue angle
    hex: string; // Hex color string
    X: number;
    Y: number;
    Z: number;
    cmyk: { C: number, M: number, Y: number, K: number };
    LRV: number;
    Density: string;
}

export interface NixSpectralData {
    lambda: number[];     // Wavelengths (nm)
    values: number[];     // Reflectance values
}

export interface NixDeviceInfo {
    id: string;
    name: string;
    type: string;
    batteryLevel: number;
    firmwareVersion: string;
    serialNumber: string;
    connected: boolean;
}

export interface NixMeasurement {
    color: NixColorData;
    spectral: NixSpectralData | null;
    deviceInfo: NixDeviceInfo;
    timestamp: string;
    scanMode: string;
    rawData: string;
}

// ============================================================
// TIPOS DE EVENTOS
// ============================================================

export type NixEventType =
    | 'scanning'
    | 'device-found'
    | 'devices-found'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'measuring'
    | 'measurement-complete'
    | 'error'
    | 'battery-changed'
    | 'status';

export interface NixEvent {
    type: NixEventType;
    data?: any;
    error?: string;
}

type NixEventListener = (event: NixEvent) => void;

// ============================================================
// UUIDs BLE DEL DISPOSITIVO NIX
// ============================================================

const NIX_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';        // Nordic UART Service
const NIX_TX_CHARACTERISTIC = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';   // TX (write to device)
const NIX_RX_CHARACTERISTIC = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';   // RX (notify from device)

// ============================================================
// TABLA DE BLANCOS DE REFERENCIA (XYZ, Observer 2° / 10°)
// Valores normalizados (Y = 100)
// ============================================================

export type ReferenceWhite =
    | 'D50/2°' | 'D65/10°' | 'A/2°' | 'A/10°' | 'C/2°' | 'C/10°'
    | 'D50/10°' | 'D55/2°' | 'D55/10°' | 'D65/2°' | 'D75/2°' | 'D75/10°'
    | 'F2/2°' | 'F2/10°' | 'F7/2°' | 'F7/10°' | 'F11/2°' | 'F11/10°';

export const REFERENCE_WHITE_XYZ: Record<ReferenceWhite, [number, number, number]> = {
    'D50/2°':  [0.96422, 1.00000, 0.82521],
    'D65/2°':  [0.95047, 1.00000, 1.08883],
    'D50/10°': [0.96720, 1.00000, 0.81427],
    'D65/10°': [0.94811, 1.00000, 1.07304],
    'D55/2°':  [0.95682, 1.00000, 0.92149],
    'D55/10°': [0.95799, 1.00000, 0.90926],
    'D75/2°':  [0.94972, 1.00000, 1.22638],
    'D75/10°': [0.94416, 1.00000, 1.20641],
    'A/2°':    [1.09850, 1.00000, 0.35585],
    'A/10°':   [1.11144, 1.00000, 0.35200],
    'C/2°':    [0.98074, 1.00000, 1.18232],
    'C/10°':   [0.97285, 1.00000, 1.16145],
    'F2/2°':   [0.99186, 1.00000, 0.67393],
    'F2/10°':  [1.03280, 1.00000, 0.69026],
    'F7/2°':   [0.95041, 1.00000, 1.08747],
    'F7/10°':  [0.95792, 1.00000, 1.07687],
    'F11/2°':  [1.00962, 1.00000, 0.64350],
    'F11/10°': [1.03866, 1.00000, 0.65627],
};

// Byte de modo de medición en el protocolo BLE Nix
const MODE_BYTES: Record<string, number> = { M0: 0x00, M1: 0x01, M2: 0x02 };

// ============================================================
// OPCIONES DE MEDICIÓN
// ============================================================

export interface MeasureOptions {
    mode?: string;           // 'M0' | 'M1' | 'M2'
    referenceWhite?: ReferenceWhite;
    averaging?: number;      // 1-5
}

// ============================================================
// DETECCIÓN DE PLATAFORMA
// ============================================================

function isNativePlatform(): boolean {
    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

function isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// ============================================================
// NIX BLUETOOTH SERVICE (DUAL: Web + Capacitor Native SDK)
// ============================================================

export class NixBluetoothService {
    private listeners: Set<NixEventListener> = new Set();
    private _deviceInfo: NixDeviceInfo = {
        id: '', name: '', type: '', batteryLevel: 0,
        firmwareVersion: '', serialNumber: '', connected: false
    };
    private measurementBuffer: number[] = [];

    // Web Bluetooth refs (solo para navegador)
    private webDevice: BluetoothDevice | null = null;
    private webServer: BluetoothRemoteGATTServer | null = null;
    private webTxChar: BluetoothRemoteGATTCharacteristic | null = null;
    private webRxChar: BluetoothRemoteGATTCharacteristic | null = null;
    private _isScanCancelled = false;

    // ============================================================
    // API PUBLICA
    // ============================================================

    static isSupported(): boolean {
        return isNativePlatform() || isWebBluetoothAvailable();
    }

    addEventListener(listener: NixEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async scanAndConnect(): Promise<NixDeviceInfo> {
        if (this._deviceInfo.connected) {
            return this._deviceInfo;
        }
        this._isScanCancelled = false;
        if (isNativePlatform()) {
            return this.scanAndConnectNative();
        } else {
            return this.scanAndConnectWeb();
        }
    }

    disconnect(): void {
        if (isNativePlatform()) {
            NixSensor.disconnect();
        } else {
            this.disconnectWeb();
        }
    }

    cancelScan(): void {
        this._isScanCancelled = true;
        if (isNativePlatform()) {
            NixSensor.stopScan().catch(() => {});
        }
        this.emit({ type: 'error', error: 'Escaneo cancelado' });
    }

    getDeviceInfo(): NixDeviceInfo {
        return { ...this._deviceInfo };
    }

    async measure(options?: MeasureOptions): Promise<NixMeasurement> {
        if (isNativePlatform()) {
            return this.measureNative(options);
        } else {
            return this.measureWeb(options);
        }
    }

    /**
     * Toma N mediciones (multiPointAveraging) y devuelve el promedio como una
     * única NixMeasurement. Si N=1, equivale a measure().
     */
    async measureMultiple(n: number, options?: MeasureOptions): Promise<NixMeasurement> {
        const count = Math.max(1, Math.min(5, n));
        if (count === 1) return this.measure(options);

        const results: NixMeasurement[] = [];
        for (let i = 0; i < count; i++) {
            const m = await this.measure(options);
            results.push(m);
        }

        // Promediar valores LAB y RGB
        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const avgL = avg(results.map(r => r.color.L));
        const avgA = avg(results.map(r => r.color.a));
        const avgB = avg(results.map(r => r.color.b));
        const avgR = Math.round(avg(results.map(r => r.color.R)));
        const avgG = Math.round(avg(results.map(r => r.color.G)));
        const avgBv = Math.round(avg(results.map(r => r.color.B)));
        const avgC = avg(results.map(r => r.color.C));
        const avgH = avg(results.map(r => r.color.H));
        const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        const avgHex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgBv)}`;

        const avgX = avg(results.map(r => r.color.X));
        const avgY = avg(results.map(r => r.color.Y));
        const avgZ = avg(results.map(r => r.color.Z));
        
        const avgCMYK_C = avg(results.map(r => r.color.cmyk.C));
        const avgCMYK_M = avg(results.map(r => r.color.cmyk.M));
        const avgCMYK_Y = avg(results.map(r => r.color.cmyk.Y));
        const avgCMYK_K = avg(results.map(r => r.color.cmyk.K));

        const avgLRV = avg(results.map(r => r.color.LRV));
        
        // Approx density for average (using avg Y)
        const avgDensityStr = avgY > 0 ? (-Math.log10(avgY / 100)).toFixed(2) : "0.00";

        const last = results[results.length - 1];
        return {
            ...last,
            color: {
                L: parseFloat(avgL.toFixed(2)),
                a: parseFloat(avgA.toFixed(2)),
                b: parseFloat(avgB.toFixed(2)),
                R: avgR, G: avgG, B: avgBv,
                C: parseFloat(avgC.toFixed(2)),
                H: parseFloat(avgH.toFixed(2)),
                hex: avgHex,
                X: parseFloat(avgX.toFixed(2)),
                Y: parseFloat(avgY.toFixed(2)),
                Z: parseFloat(avgZ.toFixed(2)),
                cmyk: {
                    C: Math.round(avgCMYK_C),
                    M: Math.round(avgCMYK_M),
                    Y: Math.round(avgCMYK_Y),
                    K: Math.round(avgCMYK_K)
                },
                LRV: parseFloat(avgLRV.toFixed(2)),
                Density: avgDensityStr
            },
            scanMode: `${options?.mode ?? 'M0'} avg${count}`,
            timestamp: new Date().toISOString(),
        };
    }

    async readBattery(): Promise<number> {
        if (isNativePlatform()) {
            // El plugin nativo maneja la batería vía eventos o lectura interna
            return this._deviceInfo.batteryLevel;
        } else {
            return this.readBatteryWeb();
        }
    }

    private foundDevices: DiscoveredDevice[] = [];
    private foundDeviceIds: Set<string> = new Set();
    private scanResolve: ((value: NixDeviceInfo) => void) | null = null;
    private scanReject: ((reason: any) => void) | null = null;
    private persistentListeners: { remove: () => void }[] = [];

    /**
     * Verifica si un dispositivo BLE es un Nix conocido por nombre o tipo.
     */
    private isNixDevice(name: string, type?: string): boolean {
        // Si el plugin nativo ya identificó el tipo, aceptarlo directamente
        if (type && type !== 'UNKNOWN') return true;
        // Fallback: verificar por nombre (Nix usa prefijos como "Nix Mini", "Nix Spectro", etc.)
        const n = (name ?? '').toLowerCase();
        return n.includes('nix');
    }

    // ============================================================
    // NATIVE CAPACITOR PLUGIN (ANDROID SDK)
    // ============================================================

    private async scanAndConnectNative(): Promise<NixDeviceInfo> {
        // Limpiar escaneo anterior si existía
        if (this.scanReject) {
            this.scanReject(new Error('Nuevo escaneo iniciado'));
        }
        this.scanResolve = null;
        this.scanReject = null;
        this.foundDevices = [];
        this.foundDeviceIds = new Set();
        this.emit({ type: 'scanning' });

        return new Promise((resolve, reject) => {
            this.scanResolve = resolve;
            this.scanReject = reject;

            // Escuchar eventos de dispositivos encontrados durante el escaneo
            const deviceFoundHandler = NixSensor.addListener('deviceFound', (device: any) => {
                const deviceType = device.type as string | undefined;

                // Filtrar: solo aceptar dispositivos Nix
                if (!this.isNixDevice(device.name, deviceType)) {
                    console.log(`Dispositivo ignorado (no es Nix): ${device.name} [${device.id}]`);
                    return;
                }

                // Deduplicar por MAC address (id): si ya existe, solo actualizar RSSI
                if (this.foundDeviceIds.has(device.id)) {
                    const existing = this.foundDevices.find(d => d.id === device.id);
                    if (existing) {
                        existing.rssi = device.rssi ?? existing.rssi;
                    }
                    return;
                }

                console.log(`¡Dispositivo Nix encontrado!: ${device.name} [${device.id}] RSSI: ${device.rssi}`);
                this.foundDeviceIds.add(device.id);
                this.foundDevices.push({
                    id: device.id,
                    name: device.name,
                    rssi: device.rssi ?? -100,
                    type: deviceType
                });
                this.emit({ type: 'device-found', data: { id: device.id, name: device.name, rssi: device.rssi } });
            });

            const scanCompleteHandler = NixSensor.addListener('scanComplete', (data: any) => {
                deviceFoundHandler.remove();
                scanCompleteHandler.remove();
                scanFailedHandler.remove();

                if (this._isScanCancelled) {
                    reject(new Error('Escaneo cancelado'));
                    return;
                }

                const count = this.foundDevices.length;
                console.log(`Escaneo completado. ${count} dispositivo(s) Nix encontrado(s).`);

                if (this.foundDevices.length === 0) {
                    this.emit({ type: 'error', error: 'No se encontraron dispositivos Nix' });
                    reject(new Error('No se encontraron dispositivos Nix'));
                    return;
                }

                // Ordenar por RSSI (mayor señal primero)
                this.foundDevices.sort((a, b) => b.rssi - a.rssi);

                // Emitir lista de dispositivos encontrados para que la UI muestre selector
                this.emit({ type: 'devices-found', data: [...this.foundDevices] });
            });

            const scanFailedHandler = NixSensor.addListener('scanFailed', (data: any) => {
                deviceFoundHandler.remove();
                scanCompleteHandler.remove();
                scanFailedHandler.remove();
                this.emit({ type: 'error', error: `Error en escaneo nativo: ${data.error}` });
                reject(new Error(`Error en escaneo nativo: ${data.error}`));
            });

            // Iniciar escaneo nativo
            NixSensor.startScan().catch(err => {
                deviceFoundHandler.remove();
                scanCompleteHandler.remove();
                scanFailedHandler.remove();
                this.emit({ type: 'error', error: err.message });
                reject(err);
            });

            // Configurar otros listeners persistentes (limpiar anteriores si existen)
            this.persistentListeners.forEach(l => l.remove());
            this.persistentListeners = [];

            this.persistentListeners.push(
                NixSensor.addListener('batteryChanged', (data: any) => {
                    this._deviceInfo.batteryLevel = data.level;
                    this.emit({ type: 'battery-changed', data: data.level });
                })
            );

            this.persistentListeners.push(
                NixSensor.addListener('deviceDisconnected', () => {
                    this._deviceInfo.connected = false;
                    this.emit({ type: 'disconnected' });
                })
            );
        });
    }

    async selectDeviceAndConnect(id: string): Promise<NixDeviceInfo> {
        const device = this.foundDevices.find(d => d.id === id);
        if (!device) {
            throw new Error(`Dispositivo ${id} no encontrado en la lista de escaneo`);
        }

        // Desconectar dispositivo anterior si hay uno conectado
        if (this._deviceInfo.connected) {
            this.emit({ type: 'status', data: 'Desconectando dispositivo anterior...' });
            this.disconnect();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this._deviceInfo = {
            ...this._deviceInfo,
            id: device.id,
            name: device.name,
            type: this.detectDeviceType(device.name),
        };

        this.emit({ type: 'connecting', data: this._deviceInfo });

        // Registrar listeners ANTES de llamar a connect (evita race condition)
        return new Promise((resolve, reject) => {
            let resolved = false;

            const connectedHandler = NixSensor.addListener('deviceConnected', (data: any) => {
                if (resolved) return;
                resolved = true;
                this._deviceInfo = { ...this._deviceInfo, connected: true };
                if (data.batteryLevel !== undefined) {
                    this._deviceInfo.batteryLevel = data.batteryLevel;
                }
                this.emit({ type: 'connected', data: this._deviceInfo });
                connectedHandler.remove();
                disconnectHandler.remove();
                if (this.scanResolve) {
                    this.scanResolve(this._deviceInfo);
                    this.scanResolve = null;
                    this.scanReject = null;
                }
                resolve(this._deviceInfo);
            });

            const disconnectHandler = NixSensor.addListener('deviceDisconnected', () => {
                if (resolved) return;
                resolved = true;
                connectedHandler.remove();
                disconnectHandler.remove();
                this._deviceInfo = { ...this._deviceInfo, connected: false };
                this.emit({ type: 'disconnected' });
                const err = new Error('Conexión fallida');
                if (this.scanReject) {
                    this.scanReject(err);
                    this.scanResolve = null;
                    this.scanReject = null;
                }
                reject(err);
            });

            // Llamar a connect DESPUÉS de registrar los listeners
            NixSensor.connect({ id: device.id }).catch(err => {
                if (!resolved) {
                    resolved = true;
                    connectedHandler.remove();
                    disconnectHandler.remove();
                    this.emit({ type: 'error', error: err.message });
                    if (this.scanReject) {
                        this.scanReject(err);
                        this.scanResolve = null;
                        this.scanReject = null;
                    }
                    reject(err);
                }
            });
        });
    }

    getFoundDevices(): DiscoveredDevice[] {
        return [...this.foundDevices];
    }

    private async measureNative(options?: MeasureOptions): Promise<NixMeasurement> {
        this.emit({ type: 'measuring' });

        try {
            const mode = options?.mode ?? 'M0';
            const refWhite = options?.referenceWhite ?? 'D50/2°';

            const result = await NixSensor.measure({
                mode,
                referenceWhite: refWhite
            });

            const color = result.color;
            const metrics = labToAllMetrics(color.L, color.a, color.b, refWhite);
            const C = Math.sqrt(color.a * color.a + color.b * color.b);
            const H = (Math.atan2(color.b, color.a) * 180 / Math.PI + 360) % 360;
            const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

            const measurement: NixMeasurement = {
                color: {
                    L: color.L, a: color.a, b: color.b,
                    R: metrics.r, G: metrics.g, B: metrics.b,
                    C: parseFloat(C.toFixed(2)),
                    H: parseFloat(H.toFixed(2)),
                    hex: `#${toHex(metrics.r)}${toHex(metrics.g)}${toHex(metrics.b)}`,
                    X: metrics.X,
                    Y: metrics.Y,
                    Z: metrics.Z,
                    cmyk: metrics.cmyk,
                    LRV: metrics.LRV,
                    Density: metrics.Density
                },
                spectral: null,
                deviceInfo: { ...this._deviceInfo },
                timestamp: new Date().toISOString(),
                scanMode: mode,
                rawData: ''
            };

            this.emit({ type: 'measurement-complete', data: measurement });
            return measurement;
        } catch (error: any) {
            this.emit({ type: 'error', error: `Error en medición nativa: ${error.message}` });
            throw error;
        }
    }

    // ============================================================
    // WEB BLUETOOTH (NAVEGADOR DE ESCRITORIO)
    // ============================================================

    private async scanAndConnectWeb(): Promise<NixDeviceInfo> {
        if (!isWebBluetoothAvailable()) {
            throw new Error('Web Bluetooth no soportado. Use Chrome, Edge u Opera.');
        }

        this.emit({ type: 'scanning' });

        try {
            this.webDevice = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'Nix' }],
                optionalServices: [
                    NIX_UART_SERVICE,
                    0x180F, // Battery
                    0x180A, // Device Info
                ]
            });

            // Si se canceló mientras esperábamos la selección del usuario
            if (this._isScanCancelled) {
                throw new Error('Escaneo cancelado');
            }

            if (!this.webDevice) throw new Error('No se seleccionó ningún dispositivo');

            this._deviceInfo.id = this.webDevice.id;
            this._deviceInfo.name = this.webDevice.name || 'Nix Device';
            this._deviceInfo.type = this.detectDeviceType(this.webDevice.name || '');

            this.emit({ type: 'device-found', data: this._deviceInfo });

            this.webDevice.addEventListener('gattserverdisconnected', () => {
                this._deviceInfo.connected = false;
                this.emit({ type: 'disconnected', data: this._deviceInfo });
            });

            this.emit({ type: 'connecting', data: this._deviceInfo });
            this.webServer = await this.webDevice.gatt!.connect();

            // Descubrir UART service
            try {
                const uartService = await this.webServer.getPrimaryService(NIX_UART_SERVICE);
                this.webTxChar = await uartService.getCharacteristic(NIX_TX_CHARACTERISTIC);
                this.webRxChar = await uartService.getCharacteristic(NIX_RX_CHARACTERISTIC);
                await this.webRxChar.startNotifications();
                this.webRxChar.addEventListener('characteristicvaluechanged', (event: Event) => {
                    const target = event.target as BluetoothRemoteGATTCharacteristic;
                    const value = target.value;
                    if (value) {
                        for (let i = 0; i < value.byteLength; i++) {
                            this.measurementBuffer.push(value.getUint8(i));
                        }
                    }
                });
            } catch (e) {
                console.warn('UART service no encontrado, descubriendo genérico...', e);
                await this.discoverWebServices();
            }

            // Leer info
            await this.readDeviceInfoWeb();
            await this.readBatteryWeb();

            this._deviceInfo.connected = true;
            this.emit({ type: 'connected', data: this._deviceInfo });

            return this._deviceInfo;
        } catch (error: any) {
            if (error.name === 'NotFoundError' || error.message === 'Escaneo cancelado') {
                this.emit({ type: 'error', error: 'Escaneo cancelado por el usuario.' });
                throw new Error('Escaneo cancelado');
            }
            this.emit({ type: 'error', error: error.message });
            throw error;
        }
    }

    private async discoverWebServices(): Promise<void> {
        if (!this.webServer) return;
        try {
            const services = await this.webServer.getPrimaryServices();
            for (const service of services) {
                try {
                    const chars = await service.getCharacteristics();
                    for (const char of chars) {
                        if ((char.properties.write || char.properties.writeWithoutResponse) && !this.webTxChar) {
                            this.webTxChar = char;
                        }
                        if (char.properties.notify && !this.webRxChar) {
                            this.webRxChar = char;
                            await char.startNotifications();
                            char.addEventListener('characteristicvaluechanged', (event: Event) => {
                                const target = event.target as BluetoothRemoteGATTCharacteristic;
                                const value = target.value;
                                if (value) {
                                    for (let i = 0; i < value.byteLength; i++) {
                                        this.measurementBuffer.push(value.getUint8(i));
                                    }
                                }
                            });
                        }
                    }
                } catch { }
            }
        } catch { }
    }

    private async readDeviceInfoWeb(): Promise<void> {
        if (!this.webServer) return;
        try {
            const infoService = await this.webServer.getPrimaryService(0x180A);
            try {
                const fwChar = await infoService.getCharacteristic(0x2A26);
                const val = await fwChar.readValue();
                this._deviceInfo.firmwareVersion = new TextDecoder().decode(val.buffer);
            } catch { }
            try {
                const snChar = await infoService.getCharacteristic(0x2A25);
                const val = await snChar.readValue();
                this._deviceInfo.serialNumber = new TextDecoder().decode(val.buffer);
            } catch { }
        } catch { }
    }

    private async readBatteryWeb(): Promise<number> {
        if (!this.webServer?.connected) return 0;
        try {
            const battService = await this.webServer.getPrimaryService(0x180F);
            const battChar = await battService.getCharacteristic(0x2A19);
            const val = await battChar.readValue();
            const level = val.getUint8(0);
            this._deviceInfo.batteryLevel = level;
            this.emit({ type: 'battery-changed', data: level });
            return level;
        } catch {
            return this._deviceInfo.batteryLevel;
        }
    }

    private disconnectWeb(): void {
        if (this.webDevice?.gatt?.connected) {
            this.webDevice.gatt.disconnect();
        }
        this._deviceInfo.connected = false;
        this.emit({ type: 'disconnected' });
    }

    private async measureWeb(options?: MeasureOptions): Promise<NixMeasurement> {
        if (!this.webServer?.connected || !this.webTxChar) {
            throw new Error('Dispositivo no conectado');
        }

        this.emit({ type: 'measuring' });
        this.measurementBuffer = [];

        const modeByte = MODE_BYTES[options?.mode ?? 'M0'] ?? 0x00;

        try {
            // Byte 0: comando medición, Byte 1: modo M0/M1/M2, Byte 2: flags
            const command = new Uint8Array([0x01, modeByte, 0x01]);
            await this.webTxChar.writeValue(command.buffer);

            const rawData = await this.waitForMeasurement(10000);
            const measurement = this.parseMeasurementData(rawData, options?.mode ?? 'M0', options?.referenceWhite);

            this.emit({ type: 'measurement-complete', data: measurement });
            return measurement;
        } catch (error: any) {
            this.emit({ type: 'error', error: `Error en medición: ${error.message}` });
            throw error;
        }
    }

    // ============================================================
    // MÉTODOS COMPARTIDOS
    // ============================================================

    private emit(event: NixEvent): void {
        this.listeners.forEach(listener => listener(event));
    }

    private detectDeviceType(name: string): string {
        const n = name.toLowerCase();
        if (n.includes('spectro l')) return 'Nix Spectro L';
        if (n.includes('spectro')) return 'Nix Spectro 2';
        if (n.includes('qc')) return 'Nix QC';
        if (n.includes('pro 2')) return 'Nix Pro 2';
        if (n.includes('pro')) return 'Nix Pro';
        if (n.includes('mini 3')) return 'Nix Mini 3';
        if (n.includes('mini 2')) return 'Nix Mini 2';
        if (n.includes('mini')) return 'Nix Mini';
        return 'Nix Device';
    }

    private waitForMeasurement(timeoutMs: number): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (this.measurementBuffer.length >= 20) {
                    clearInterval(checkInterval);
                    resolve([...this.measurementBuffer]);
                    return;
                }
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    if (this.measurementBuffer.length > 0) {
                        resolve([...this.measurementBuffer]);
                    } else {
                        reject(new Error('Timeout esperando datos del dispositivo'));
                    }
                }
            }, 100);
        });
    }

    private parseMeasurementData(rawBytes: number[], mode = 'M0', refWhite: ReferenceWhite = 'D50/2°'): NixMeasurement {
        let L = 0, a = 0, b = 0;

        if (rawBytes.length >= 12) {
            const dataView = new DataView(new Uint8Array(rawBytes).buffer);
            try {
                L = dataView.getFloat32(0, true);
                a = dataView.getFloat32(4, true);
                b = dataView.getFloat32(8, true);
            } catch {
                L = rawBytes[0] / 2.55;
                a = rawBytes[1] - 128;
                b = rawBytes[2] - 128;
            }
        } else {
            L = rawBytes[0] ? rawBytes[0] / 2.55 : 50;
            a = rawBytes[1] ? rawBytes[1] - 128 : 0;
            b = rawBytes[2] ? rawBytes[2] - 128 : 0;
        }

        const metrics = labToAllMetrics(L, a, b, refWhite);
        const sR = metrics.r, sG = metrics.g, sB = metrics.b;
        const C = Math.sqrt(a * a + b * b);
        const H = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
        const hex = `#${sR.toString(16).padStart(2, '0')}${sG.toString(16).padStart(2, '0')}${sB.toString(16).padStart(2, '0')}`;

        let spectral: NixSpectralData | null = null;
        if (rawBytes.length > 50) {
            const spectralOffset = 12;
            const lambda: number[] = [];
            const values: number[] = [];
            for (let wl = 400; wl <= 700; wl += 10) {
                lambda.push(wl);
                const idx = spectralOffset + ((wl - 400) / 10) * 4;
                if (idx + 3 < rawBytes.length) {
                    const dv = new DataView(new Uint8Array(rawBytes.slice(idx, idx + 4)).buffer);
                    values.push(dv.getFloat32(0, true));
                }
            }
            if (values.length > 0) spectral = { lambda, values };
        }

        return {
            color: {
                L: parseFloat(L.toFixed(2)),
                a: parseFloat(a.toFixed(2)),
                b: parseFloat(b.toFixed(2)),
                R: sR, G: sG, B: sB,
                C: parseFloat(C.toFixed(2)),
                H: parseFloat(H.toFixed(2)),
                hex,
                X: metrics.X,
                Y: metrics.Y,
                Z: metrics.Z,
                cmyk: metrics.cmyk,
                LRV: metrics.LRV,
                Density: metrics.Density
            },
            spectral,
            deviceInfo: { ...this._deviceInfo },
            timestamp: new Date().toISOString(),
            scanMode: mode,
            rawData: rawBytes.map(b => b.toString(16).padStart(2, '0')).join(''),
        };
    }
}

// ============================================================
// UTILIDADES DE CONVERSIÓN DE COLOR
// ============================================================

/**
 * Convierte L*a*b* → a múltiples métricas usando el blanco de referencia especificado.
 */
function labToAllMetrics(
    L: number, a: number, b: number,
    refWhite: ReferenceWhite = 'D50/2°'
) {
    const [Xn, Yn, Zn] = REFERENCE_WHITE_XYZ[refWhite] ?? REFERENCE_WHITE_XYZ['D50/2°'];

    let fy = (L + 16) / 116;
    let fx = a / 500 + fy;
    let fz = fy - b / 200;

    const delta = 6 / 29;
    let x = (fx > delta ? fx * fx * fx : (116 * fx - 16) / 903.3) * Xn;
    let y = (L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3) * Yn;
    let z = (fz > delta ? fz * fz * fz : (116 * fz - 16) / 903.3) * Zn;

    const X = x * 100;
    const Y = y * 100;
    const Z = z * 100;
    const LRV = Math.max(0, Y);
    const Density = y > 0 ? (-Math.log10(y)).toFixed(2) : "0.00";

    // sRGB matrix (Bradford-adapted from D50)
    let r = x * 3.1338561 + y * -1.6168667 + z * -0.4906146;
    let g = x * -0.9787684 + y * 1.9161415 + z * 0.0334540;
    let bv = x * 0.0719453 + y * -0.2289914 + z * 1.4052427;

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    bv = bv > 0.0031308 ? 1.055 * Math.pow(bv, 1 / 2.4) - 0.055 : 12.92 * bv;

    r = Math.max(0, Math.min(1, r));
    g = Math.max(0, Math.min(1, g));
    bv = Math.max(0, Math.min(1, bv));

    // CMYK Approx
    const k = 1 - Math.max(r, g, bv);
    const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
    const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
    const y_cmyk = k === 1 ? 0 : (1 - bv - k) / (1 - k);

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(bv * 255),
        X: parseFloat(X.toFixed(2)),
        Y: parseFloat(Y.toFixed(2)),
        Z: parseFloat(Z.toFixed(2)),
        cmyk: {
            C: Math.round(c * 100),
            M: Math.round(m * 100),
            Y: Math.round(y_cmyk * 100),
            K: Math.round(k * 100)
        },
        LRV: parseFloat(LRV.toFixed(2)),
        Density
    };
}

export function deltaE2000(
    L1: number, a1: number, b1: number,
    L2: number, a2: number, b2: number
): number {
    const rad = Math.PI / 180;
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const mC = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(mC, 7) / (Math.pow(mC, 7) + Math.pow(25, 7))));
    const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);
    let h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360;
    let h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp: number;
    if (C1p * C2p === 0) dhp = 0;
    else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
    else dhp = h2p - h1p + 360;
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const mLp = (L1 + L2) / 2, mCp = (C1p + C2p) / 2;
    let mhp: number;
    if (C1p * C2p === 0) mhp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) mhp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) mhp = (h1p + h2p + 360) / 2;
    else mhp = (h1p + h2p - 360) / 2;
    const T = 1 - 0.17 * Math.cos((mhp - 30) * rad) + 0.24 * Math.cos(2 * mhp * rad)
        + 0.32 * Math.cos((3 * mhp + 6) * rad) - 0.2 * Math.cos((4 * mhp - 63) * rad);
    const SL = 1 + (0.015 * Math.pow(mLp - 50, 2)) / Math.sqrt(20 + Math.pow(mLp - 50, 2));
    const SC = 1 + 0.045 * mCp;
    const SH = 1 + 0.015 * mCp * T;
    const RT = -2 * Math.sqrt(Math.pow(mCp, 7) / (Math.pow(mCp, 7) + Math.pow(25, 7)))
        * Math.sin(60 * rad * Math.exp(-Math.pow((mhp - 275) / 25, 2)));
    return Math.sqrt(
        Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2)
        + RT * (dCp / SC) * (dHp / SH)
    );
}

export const nixService = new NixBluetoothService();
