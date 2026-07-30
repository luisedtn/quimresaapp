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
import com.nixsensor.universalsdk.DeviceType;
import com.nixsensor.universalsdk.IDeviceCompat;
import com.nixsensor.universalsdk.IDeviceCompat.OnDeviceStateChangeListener;
import com.nixsensor.universalsdk.IDeviceScanner;
import com.nixsensor.universalsdk.IDeviceScanner.OnDeviceFoundListener;
import com.nixsensor.universalsdk.IDeviceScanner.OnScannerStateChangeListener;
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

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

@CapacitorPlugin(name = "NixSensorPlugin", permissions = {
        @Permission(alias = "bluetooth", strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "location", strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        })
})
public class NixSensorPlugin extends Plugin {
    private IDeviceScanner scanner;
    private final Map<String, IDeviceCompat> discoveredDevices = new HashMap<>();
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

            // Diagnosticar qué dispositivos permite la licencia
            try {
                java.util.Set<DeviceType> allowedTypes = LicenseManager.Shared.getAllowedDeviceTypes();
                android.util.Log.d("NixSensor", "=== Tipos de dispositivo permitidos por licencia ===");
                for (DeviceType dt : allowedTypes) {
                    android.util.Log.d("NixSensor", "  - " + dt.name());
                }
                android.util.Log.d("NixSensor", "Mini 2 soportado? " + LicenseManager.Shared.isDeviceTypeSupported(DeviceType.MINI2));
                android.util.Log.d("NixSensor", "Spectro 2 soportado? " + LicenseManager.Shared.isDeviceTypeSupported(DeviceType.SPECTRO2));
                android.util.Log.d("NixSensor", "==========================================");
            } catch (Exception e) {
                android.util.Log.e("NixSensor", "Error al diagnosticar licencia: " + e.getMessage());
            }
        } catch (Exception e) {
            android.util.Log.e("NixSensor", "Fallo al cargar NixSensorPlugin: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        android.util.Log.d("NixSensor", "Solicitud de inicio de escaneo recibida");

        if (scanner == null) {
            call.reject("El escáner no se ha inicializado. Verifique la carga del plugin.");
            return;
        }

        // Verificar permisos según la versión de Android
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
                android.util.Log.w("NixSensor", "Permisos de Bluetooth no concedidos. Solicitando...");
                requestPermissionForAlias("bluetooth", call, "checkPermissionsCallback");
                return;
            }
        } else {
            if (getPermissionState("location") != PermissionState.GRANTED) {
                android.util.Log.w("NixSensor", "Permiso de ubicación no concedido (requerido para BLE en Android <12). Solicitando...");
                requestPermissionForAlias("location", call, "checkPermissionsCallback");
                return;
            }
        }

        if (scanner != null && scanner.getState() == DeviceScannerState.SCANNING) {
            android.util.Log.d("NixSensor", "El escáner ya estaba corriendo, reiniciando...");
            scanner.stop();
        }

        discoveredDevices.clear();
        android.util.Log.d("NixSensor", "Llamando a scanner.start()...");

        scanner.setOnScannerStateChangeListener(new OnScannerStateChangeListener() {
            @Override
            public void onScannerStarted(@NonNull IDeviceScanner sender) {
                android.util.Log.d("NixSensor", "Escáner iniciado");
                notifyListeners("scanStarted", new JSObject());
            }

            @Override
            public void onScannerStopped(@NonNull IDeviceScanner sender) {
                android.util.Log.d("NixSensor", "Escáner detenido. Dispositivos encontrados: " + discoveredDevices.size());
                JSObject ret = new JSObject();
                ret.put("deviceCount", discoveredDevices.size());
                JSONArray devicesArray = new JSONArray();
                for (Map.Entry<String, IDeviceCompat> entry : discoveredDevices.entrySet()) {
                    IDeviceCompat d = entry.getValue();
                    JSONObject devObj = new JSONObject();
                    try {
                        devObj.put("id", d.getId());
                        devObj.put("name", d.getName());
                        devObj.put("rssi", d.getRssi());
                    } catch (JSONException e) {
                        android.util.Log.e("NixSensor", "Error creando JSON de dispositivo: " + e.getMessage());
                    }
                    devicesArray.put(devObj);
                }
                ret.put("devices", devicesArray);
                notifyListeners("scanComplete", ret);
            }
        });

        scanner.start(new OnDeviceFoundListener() {
            @Override
            public void onScanResult(@NonNull IDeviceScanner sender, @NonNull IDeviceCompat device) {
                // Filtrar: solo aceptar dispositivos con tipo Nix reconocido (no UNKNOWN)
                DeviceType deviceType = device.getType();
                if (deviceType == DeviceType.UNKNOWN) {
                    android.util.Log.d("NixSensor",
                            "Dispositivo ignorado (no es Nix): ID: " + device.getId()
                                    + " Name: " + device.getName() + " Type: " + deviceType);
                    return;
                }

                android.util.Log.i("NixSensor",
                        "¡Dispositivo Nix encontrado! ID: " + device.getId()
                                + " Name: " + device.getName()
                                + " RSSI: " + device.getRssi()
                                + " Type: " + deviceType.name());
                discoveredDevices.put(device.getId(), device);
                JSObject ret = new JSObject();
                ret.put("id", device.getId());
                ret.put("name", device.getName());
                ret.put("rssi", device.getRssi());
                ret.put("type", deviceType.name());
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
        if (getPermissionState("bluetooth") == PermissionState.GRANTED || getPermissionState("location") == PermissionState.GRANTED) {
            startScan(call);
        } else {
            call.reject("Permisos necesarios denegados");
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

        // Desconectar dispositivo anterior si hay uno activo y es diferente al nuevo
        if (activeDevice != null) {
            String currentId = activeDevice.getId();
            if (!currentId.equals(id)) {
                android.util.Log.d("NixSensor", "Desconectando dispositivo anterior: " + currentId);
                activeDevice.disconnect();
                activeDevice = null;
            }
        }

        IDeviceCompat newDevice = discoveredDevices.get(id);

        if (newDevice != null) {
            activeDevice = newDevice;

            // Si el dispositivo ya está conectado (estado != DISCONNECTED),
            // emitir evento deviceConnected y resolver inmediatamente
            if (activeDevice.getState() != DeviceState.DISCONNECTED) {
                android.util.Log.w("NixSensor",
                        "El dispositivo ya está conectado o en proceso. Estado: " + activeDevice.getState().name());
                JSObject ret = new JSObject();
                ret.put("connected", true);
                Integer batteryLevel = activeDevice.getBatteryLevel();
                ret.put("batteryLevel", Objects.requireNonNullElse(batteryLevel, -1));
                notifyListeners("deviceConnected", ret);
                call.resolve();
                return;
            }

            android.util.Log.d("NixSensor", "Iniciando conexión con: " + id);
            activeDevice.connect(new OnDeviceStateChangeListener() {
                @Override
                public void onConnected(@NonNull IDeviceCompat sender) {
                    android.util.Log.i("NixSensor", "¡Conexión exitosa con el dispositivo! ID: " + sender.getId());
                    JSObject ret = new JSObject();
                    ret.put("connected", true);

                    // Enviar nivel de batería inicial
                    Integer batteryLevel = sender.getBatteryLevel();
                    ret.put("batteryLevel", Objects.requireNonNullElse(batteryLevel, -1));

                    notifyListeners("deviceConnected", ret);
                }

                @Override
                public void onDisconnected(@NonNull IDeviceCompat sender, @NonNull DeviceStatus status) {
                    android.util.Log.w("NixSensor", "Dispositivo desconectado: " + sender.getId() + " Razón: " + status.name());
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
            android.util.Log.e("NixSensor", "Error: Dispositivo no encontrado en la caché de escaneo: " + id);
            call.reject("Dispositivo no encontrado o no escaneado previamente");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (activeDevice != null) {
            android.util.Log.d("NixSensor", "Desconectando dispositivo: " + activeDevice.getId());
            activeDevice.disconnect();
            activeDevice = null;
        }
        // NO limpiar discoveredDevices aquí para permitir reconexión a otro dispositivo
        // sin necesidad de un nuevo escaneo. El caché se limpia al iniciar un nuevo scan.
        call.resolve();
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        android.util.Log.d("NixSensor", "Deteniendo escáner por solicitud del usuario...");
        if (scanner != null && scanner.getState() == DeviceScannerState.SCANNING) {
            scanner.stop();
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
        return switch (s) {
            case "M1" -> ScanMode.M1;
            case "M2" -> ScanMode.M2;
            default -> ScanMode.M0;
        };
    }

    private ReferenceWhite parseReferenceWhite(String s) {
        if (s == null) return ReferenceWhite.D50_2;
        try {
            // Convierte D50/2° -> D50_2
            String normalized = s.replace("/", "_").replace("°", "");
            return ReferenceWhite.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            android.util.Log.w("NixSensor", "Referencia blanca desconocida: " + s + ". Usando D50/2° por defecto.");
            return ReferenceWhite.D50_2;
        }
    }
}
