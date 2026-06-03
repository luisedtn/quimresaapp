package com.quimresa.colorapp;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

import com.nixsensor.universalsdk.DeviceScanner;
import com.nixsensor.universalsdk.IDeviceCompat;
import com.nixsensor.universalsdk.IDeviceCompat.OnDeviceStateChangeListener;
import com.nixsensor.universalsdk.IDeviceScanner;
import com.nixsensor.universalsdk.IDeviceScanner.OnDeviceFoundListener;
import com.nixsensor.universalsdk.IDeviceScanner.DeviceScannerState;
import com.nixsensor.universalsdk.IMeasurementData;
import com.nixsensor.universalsdk.IColorData;
import com.nixsensor.universalsdk.LicenseManager;
import com.nixsensor.universalsdk.ReferenceWhite;
import com.nixsensor.universalsdk.DeviceState;
import com.nixsensor.universalsdk.DeviceStatus;
import com.nixsensor.universalsdk.CommandStatus;
import com.nixsensor.universalsdk.ScanMode;
import com.nixsensor.universalsdk.OnDeviceResultListener;

import java.util.HashMap;
import java.util.Map;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@CapacitorPlugin(name = "NixSensorPlugin", permissions = {
        @Permission(alias = "bluetooth", strings = {
                "android.permission.BLUETOOTH_SCAN",
                "android.permission.BLUETOOTH_CONNECT"
        })
})
public class NixSensorPlugin extends Plugin {
    private IDeviceScanner scanner;
    private Map<String, IDeviceCompat> discoveredDevices = new HashMap<>();
    private IDeviceCompat activeDevice;

    @Override
    public void load() {
        try {
            android.util.Log.d("NixSensor", "Cargando NixSensorPlugin y activando licencia...");
            // CONFIGURA TU LICENCIA AQUÍ
            LicenseManager.Shared.activate(
                    getContext(),
                    "e=1&n=1&u=69cd37a34d024be4b6ab61abaad21f67",
                    "MEMCIH81lCTKpUTbqoHQq7UDX5rqnPxP3rEHmGRZPQg9v4ggAh9qHCkWN/QU0+R2VvHuk28SsK45brboVoPxhembi3Pg");

            scanner = new DeviceScanner(getContext());
            android.util.Log.d("NixSensor", "NixSensorPlugin cargado exitosamente");
        } catch (Exception e) {
            android.util.Log.e("NixSensor", "Fallo al cargar NixSensorPlugin: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        android.util.Log.d("NixSensor", "Solicitud de inicio de escaneo recibida");

        // Verificar permisos en Android 12+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            if (getContext().checkSelfPermission(
                    Manifest.permission.BLUETOOTH_SCAN) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                android.util.Log.w("NixSensor", "Permiso BLUETOOTH_SCAN no concedido. Solicitando...");
                requestPermissionForAlias("bluetooth", call, "checkPermissionsCallback");
                return;
            }
        }

        if (scanner.getState() == DeviceScannerState.SCANNING) {
            android.util.Log.d("NixSensor", "El escáner ya estaba corriendo, reiniciando...");
            scanner.stop();
        }

        discoveredDevices.clear();
        android.util.Log.d("NixSensor", "Llamando a scanner.start()...");

        scanner.start(new OnDeviceFoundListener() {
            @Override
            public void onScanResult(@NonNull IDeviceScanner sender, @NonNull IDeviceCompat device) {
                android.util.Log.i("NixSensor",
                        "¡Dispositivo encontrado! ID: " + device.getId() + " Name: " + device.getName());
                discoveredDevices.put(device.getId(), device);
                JSObject ret = new JSObject();
                ret.put("id", device.getId());
                ret.put("name", device.getName());
                notifyListeners("deviceFound", ret);
            }

            @Override
            public void onScanFailed(@NonNull IDeviceScanner sender, int errorCode) {
                android.util.Log.e("NixSensor", "Error en el escaneo nativo. Código: " + errorCode);
                JSObject ret = new JSObject();
                ret.put("error", errorCode);
                notifyListeners("scanFailed", ret);
            }
        }, IDeviceScanner.DEFAULT_GENERAL_SCAN_PERIOD_MS);

        call.resolve();
    }

    @PermissionCallback
    public void checkPermissionsCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            startScan(call);
        } else {
            call.reject("Permisos de Bluetooth denegados");
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("ID de dispositivo requerido");
            return;
        }

        // Importante: Detener escaneo antes de conectar para evitar interferencias
        if (scanner != null && scanner.getState() == DeviceScannerState.SCANNING) {
            android.util.Log.d("NixSensor", "Deteniendo escáner antes de conectar...");
            scanner.stop();
        }

        activeDevice = discoveredDevices.get(id);

        if (activeDevice != null) {
            // IDLE significa que ya está conectado y listo.
            // Si no está DISCONNECTED, asumimos que está en proceso de conexión o ya listo.
            if (activeDevice.getState() != DeviceState.DISCONNECTED) {
                android.util.Log.w("NixSensor",
                        "El dispositivo ya está conectado o en proceso. Estado: " + activeDevice.getState().name());
                call.resolve();
                return;
            }

            android.util.Log.d("NixSensor", "Iniciando conexión con: " + id);
            activeDevice.connect(new OnDeviceStateChangeListener() {
                @Override
                public void onConnected(@NonNull IDeviceCompat sender) {
                    android.util.Log.i("NixSensor", "¡Conexión exitosa con el dispositivo!");
                    JSObject ret = new JSObject();
                    ret.put("connected", true);

                    // Enviar nivel de batería inicial
                    Integer batteryLevel = sender.getBatteryLevel();
                    ret.put("batteryLevel", batteryLevel != null ? batteryLevel : -1);

                    notifyListeners("deviceConnected", ret);
                }

                @Override
                public void onDisconnected(@NonNull IDeviceCompat sender, @NonNull DeviceStatus status) {
                    android.util.Log.w("NixSensor", "Dispositivo desconectado. Razón: " + status.name());
                    notifyListeners("deviceDisconnected", new JSObject());
                }

                @Override
                public void onBatteryStateChanged(@NonNull IDeviceCompat sender, int newState) {
                    android.util.Log.d("NixSensor", "Cambio en nivel de batería: " + newState);
                    JSObject ret = new JSObject();
                    ret.put("level", newState);
                    notifyListeners("batteryChanged", ret);
                }

                @Override
                public void onExtPowerStateChanged(@NonNull IDeviceCompat sender, boolean newState) {
                }
            });
            call.resolve();
        } else {
            android.util.Log.e("NixSensor", "Error: Dispositivo no encontrado en la caché de escaneo");
            call.reject("Dispositivo no encontrado o no escaneado previamente");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (activeDevice != null) {
            android.util.Log.d("NixSensor", "Desconectando dispositivo manualmente...");
            activeDevice.disconnect();
            activeDevice = null;
        }
        discoveredDevices.clear();
        call.resolve();
    }

    @PluginMethod
    public void measure(PluginCall call) {
        if (activeDevice == null || activeDevice.getState() != DeviceState.IDLE) {
            call.reject("Dispositivo no listo o no conectado");
            return;
        }

        String modeStr = call.getString("mode", "M0");
        String refWhiteStr = call.getString("referenceWhite", "D50/2°");

        ScanMode scanMode = parseScanMode(modeStr);
        ReferenceWhite refWhite = parseReferenceWhite(refWhiteStr);

        activeDevice.measure(new OnDeviceResultListener() {
            @Override
            public void onDeviceResult(@NonNull CommandStatus status,
                    @Nullable Map<ScanMode, ? extends IMeasurementData> results) {
                if (status == CommandStatus.SUCCESS && results != null && !results.isEmpty()) {
                    IMeasurementData mData = results.values().iterator().next();
                    if (mData != null) {
                        IColorData color = mData.toColorData(refWhite, IColorData.ColorType.CIELAB);

                        if (color != null) {
                            JSObject ret = new JSObject();
                            JSObject colorObj = new JSObject();
                            double[] lab = color.getValue();
                            colorObj.put("L", lab[0]);
                            colorObj.put("a", lab[1]);
                            colorObj.put("b", lab[2]);
                            colorObj.put("hex", color.getHexCode());

                            ret.put("color", colorObj);
                            call.resolve(ret);
                            return;
                        }
                    }
                }
                call.reject("Error al procesar medición: " + status.name());
            }
        }, scanMode);
    }

    private ScanMode parseScanMode(String s) {
        if (s == null) return ScanMode.M0;
        switch (s) {
            case "M1": return ScanMode.M1;
            case "M2": return ScanMode.M2;
            default: return ScanMode.M0;
        }
    }

    private ReferenceWhite parseReferenceWhite(String s) {
        if (s == null) return ReferenceWhite.D50_2;
        switch (s.replace("/", "_").replace("°", "")) {
            case "A_2": return ReferenceWhite.A_2;
            case "A_10": return ReferenceWhite.A_10;
            case "C_2": return ReferenceWhite.C_2;
            case "C_10": return ReferenceWhite.C_10;
            case "D50_2": return ReferenceWhite.D50_2;
            case "D50_10": return ReferenceWhite.D50_10;
            case "D55_2": return ReferenceWhite.D55_2;
            case "D55_10": return ReferenceWhite.D55_10;
            case "D65_2": return ReferenceWhite.D65_2;
            case "D65_10": return ReferenceWhite.D65_10;
            case "D75_2": return ReferenceWhite.D75_2;
            case "D75_10": return ReferenceWhite.D75_10;
            case "F2_2": return ReferenceWhite.F2_2;
            case "F2_10": return ReferenceWhite.F2_10;
            case "F7_2": return ReferenceWhite.F7_2;
            case "F7_10": return ReferenceWhite.F7_10;
            case "F11_2": return ReferenceWhite.F11_2;
            case "F11_10": return ReferenceWhite.F11_10;
            default: return ReferenceWhite.D50_2;
        }
    }
}
