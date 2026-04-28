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
    connect(options: { id: string }): Promise<NixDeviceInfo>;
    disconnect(): Promise<void>;
    measure(): Promise<{ color: NixColorData }>;
    addListener(eventName: string, listenerFunc: (data: any) => void): any;
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
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'measuring'
    | 'measurement-complete'
    | 'error'
    | 'battery-changed';

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

    getDeviceInfo(): NixDeviceInfo {
        return { ...this._deviceInfo };
    }

    async measure(): Promise<NixMeasurement> {
        if (isNativePlatform()) {
            return this.measureNative();
        } else {
            return this.measureWeb();
        }
    }

    async readBattery(): Promise<number> {
        if (isNativePlatform()) {
            // El plugin nativo maneja la batería vía eventos o lectura interna
            return this._deviceInfo.batteryLevel;
        } else {
            return this.readBatteryWeb();
        }
    }

    // ============================================================
    // NATIVE CAPACITOR PLUGIN (ANDROID SDK)
    // ============================================================

    private async scanAndConnectNative(): Promise<NixDeviceInfo> {
        this.emit({ type: 'scanning' });

        return new Promise((resolve, reject) => {
            // Escuchar cuando se encuentre un dispositivo
            const deviceFoundHandler = NixSensor.addListener('deviceFound', (device: any) => {
                console.log(`¡Dispositivo Nix encontrado!: ${device.name} [${device.id}]`);

                // Detener el listener de búsqueda de inmediato para evitar múltiples intentos de conexión
                deviceFoundHandler.remove();

                this._deviceInfo.id = device.id;
                this._deviceInfo.name = device.name;
                this._deviceInfo.type = this.detectDeviceType(device.name);

                this.emit({ type: 'device-found', data: this._deviceInfo });

                // Conectar automáticamente al primero por ahora (o implementar selector en UI)
                this.emit({ type: 'connecting', data: this._deviceInfo });

                NixSensor.connect({ id: device.id }).then(() => {
                    // Esperar al evento de conexión real para mayor seguridad
                    const connectedHandler = NixSensor.addListener('deviceConnected', (data: any) => {
                        this._deviceInfo.connected = true;
                        if (data.batteryLevel !== undefined) {
                            this._deviceInfo.batteryLevel = data.batteryLevel;
                        }
                        this.emit({ type: 'connected', data: this._deviceInfo });
                        connectedHandler.remove();
                        resolve(this._deviceInfo);
                    });
                }).catch(err => {
                    this.emit({ type: 'error', error: err.message });
                    reject(err);
                });
            });

            // Iniciar escaneo nativo
            NixSensor.startScan().catch(err => {
                this.emit({ type: 'error', error: err.message });
                reject(err);
            });

            // Configurar otros listeners
            NixSensor.addListener('batteryChanged', (data: any) => {
                this._deviceInfo.batteryLevel = data.level;
                this.emit({ type: 'battery-changed', data: data.level });
            });

            NixSensor.addListener('deviceDisconnected', () => {
                this._deviceInfo.connected = false;
                this.emit({ type: 'disconnected' });
            });
        });
    }

    private async measureNative(): Promise<NixMeasurement> {
        this.emit({ type: 'measuring' });

        try {
            const result = await NixSensor.measure();

            const measurement: NixMeasurement = {
                color: result.color,
                spectral: null, // El plugin simple no lo devuelve todavía
                deviceInfo: { ...this._deviceInfo },
                timestamp: new Date().toISOString(),
                scanMode: 'M0',
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
            if (error.name === 'NotFoundError') {
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

    private async measureWeb(): Promise<NixMeasurement> {
        if (!this.webServer?.connected || !this.webTxChar) {
            throw new Error('Dispositivo no conectado');
        }

        this.emit({ type: 'measuring' });
        this.measurementBuffer = [];

        try {
            const command = new Uint8Array([0x01, 0x00, 0x01]);
            await this.webTxChar.writeValue(command.buffer);

            const rawData = await this.waitForMeasurement(10000);
            const measurement = this.parseMeasurementData(rawData);

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

    private parseMeasurementData(rawBytes: number[]): NixMeasurement {
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

        const rgb = labToRgb(L, a, b);
        const sR = rgb.r, sG = rgb.g, sB = rgb.b;
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
            },
            spectral,
            deviceInfo: { ...this._deviceInfo },
            timestamp: new Date().toISOString(),
            scanMode: 'M0',
            rawData: rawBytes.map(b => b.toString(16).padStart(2, '0')).join(''),
        };
    }
}

// ============================================================
// UTILIDADES DE CONVERSIÓN DE COLOR
// ============================================================

function labToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
    let fy = (L + 16) / 116;
    let fx = a / 500 + fy;
    let fz = fy - b / 200;

    const delta = 6 / 29;
    let x = fx > delta ? fx * fx * fx : (116 * fx - 16) / 903.3;
    let y = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
    let z = fz > delta ? fz * fz * fz : (116 * fz - 16) / 903.3;

    x *= 0.9642; y *= 1.0000; z *= 0.8251;

    let r = x * 3.1338561 + y * -1.6168667 + z * -0.4906146;
    let g = x * -0.9787684 + y * 1.9161415 + z * 0.0334540;
    let bv = x * 0.0719453 + y * -0.2289914 + z * 1.4052427;

    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
    bv = bv > 0.0031308 ? 1.055 * Math.pow(bv, 1 / 2.4) - 0.055 : 12.92 * bv;

    return {
        r: Math.max(0, Math.min(255, Math.round(r * 255))),
        g: Math.max(0, Math.min(255, Math.round(g * 255))),
        b: Math.max(0, Math.min(255, Math.round(bv * 255))),
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
