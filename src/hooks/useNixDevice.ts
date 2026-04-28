/**
 * useNixDevice.ts
 * React hook para interactuar con dispositivos Nix vía Web Bluetooth.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    nixService,
    NixBluetoothService,
    NixDeviceInfo,
    NixMeasurement,
    NixEvent
} from '../services/NixBluetoothService';

export interface UseNixDeviceReturn {
    // Estado
    isSupported: boolean;
    isScanning: boolean;
    isConnecting: boolean;
    isConnected: boolean;
    isMeasuring: boolean;
    deviceInfo: NixDeviceInfo | null;
    lastMeasurement: NixMeasurement | null;
    measurements: NixMeasurement[];
    error: string | null;
    status: string;

    // Acciones
    scan: () => Promise<void>;
    disconnect: () => void;
    measure: () => Promise<NixMeasurement | null>;
    clearMeasurements: () => void;
    clearError: () => void;
}

export function useNixDevice(): UseNixDeviceReturn {
    const [isSupported] = useState(() => NixBluetoothService.isSupported());
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(() => nixService.getDeviceInfo().connected);
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState<NixDeviceInfo | null>(() => {
        const info = nixService.getDeviceInfo();
        return info.connected ? info : null;
    });
    const [lastMeasurement, setLastMeasurement] = useState<NixMeasurement | null>(null);
    const [measurements, setMeasurements] = useState<NixMeasurement[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState(() => nixService.getDeviceInfo().connected ? `Conectado a ${nixService.getDeviceInfo().name}` : 'Desconectado');

    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Suscribir a eventos del servicio Nix
    useEffect(() => {
        const handleEvent = (event: NixEvent) => {
            switch (event.type) {
                case 'scanning':
                    setIsScanning(true);
                    setStatus('Buscando dispositivos Nix...');
                    break;
                case 'device-found':
                    setIsScanning(false);
                    setStatus(`Dispositivo encontrado: ${event.data?.name}`);
                    break;
                case 'connecting':
                    setIsConnecting(true);
                    setStatus('Conectando...');
                    break;
                case 'connected':
                    setIsConnecting(false);
                    setIsConnected(true);
                    setDeviceInfo(event.data);
                    setStatus(`Conectado a ${event.data?.name}`);
                    break;
                case 'disconnected':
                    setIsConnected(false);
                    setIsConnecting(false);
                    setIsMeasuring(false);
                    setStatus('Desconectado');
                    break;
                case 'measuring':
                    setIsMeasuring(true);
                    setStatus('Escaneando color...');
                    break;
                case 'measurement-complete':
                    setIsMeasuring(false);
                    setStatus('Medición completada');
                    if (event.data) {
                        setLastMeasurement(event.data);
                        setMeasurements(prev => [event.data, ...prev]);
                    }
                    break;
                case 'battery-changed':
                    setDeviceInfo(prev => prev ? { ...prev, batteryLevel: event.data } : null);
                    break;
                case 'error':
                    setIsScanning(false);
                    setIsConnecting(false);
                    setIsMeasuring(false);
                    setError(event.error || 'Error desconocido');
                    setStatus('Error');
                    break;
            }
        };

        unsubscribeRef.current = nixService.addEventListener(handleEvent);

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const scan = useCallback(async () => {
        setError(null);
        try {
            await nixService.scanAndConnect();
        } catch (err: any) {
            if (err.message !== 'Escaneo cancelado') {
                setError(err.message);
            }
        }
    }, []);

    const disconnect = useCallback(() => {
        nixService.disconnect();
    }, []);

    const measure = useCallback(async (): Promise<NixMeasurement | null> => {
        setError(null);
        try {
            return await nixService.measure();
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    }, []);

    const clearMeasurements = useCallback(() => {
        setMeasurements([]);
        setLastMeasurement(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isSupported,
        isScanning,
        isConnecting,
        isConnected,
        isMeasuring,
        deviceInfo,
        lastMeasurement,
        measurements,
        error,
        status,
        scan,
        disconnect,
        measure,
        clearMeasurements,
        clearError,
    };
}
