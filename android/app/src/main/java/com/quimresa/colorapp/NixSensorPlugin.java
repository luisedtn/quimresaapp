package com.quimresa.colorapp;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

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

@CapacitorPlugin(name = "NixSensor", permissions = {
        @Permission(alias = "bluetooth", strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
        })
})
public class NixSensorPlugin extends Plugin {
    private IDeviceScanner scanner;
    private Map<String, IDeviceCompat> discoveredDevices = new HashMap<>();
    private IDeviceCompat activeDevice;

    @Override
    public void load() {
        // CONFIGURA TU LICENCIA AQUÍ
        LicenseManager.Shared.activate(
                getContext(),
                "e=1&n=1&u=69cd37a34d024be4b6ab61abaad21f67",
                "MEMCIH81lCTKpUTbqoHQq7UDX5rqnPxP3rEHmGRZPQg9v4ggAh9qHCkWN/QU0+R2VvHuk28SsK45brboVoPxhembi3Pg");

        scanner = new DeviceScanner(getContext());
    }

    @PluginMethod
    public void startScan(PluginCall call) {
        if (scanner.getState() == DeviceScannerState.SCANNING) {
            scanner.stop();
        }
        
        discoveredDevices.clear();
        scanner.start(new OnDeviceFoundListener() {
            @Override
            public void onScanResult(@NonNull IDeviceScanner sender, @NonNull IDeviceCompat device) {
                discoveredDevices.put(device.getId(), device);
                JSObject ret = new JSObject();
                ret.put("id", device.getId());
                ret.put("name", device.getName());
                notifyListeners("deviceFound", ret);
            }

            @Override
            public void onScanFailed(@NonNull IDeviceScanner sender, int errorCode) {
                JSObject ret = new JSObject();
                ret.put("error", errorCode);
                notifyListeners("scanFailed", ret);
            }
        }, IDeviceScanner.DEFAULT_GENERAL_SCAN_PERIOD_MS);
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("ID de dispositivo requerido");
            return;
        }

        activeDevice = discoveredDevices.get(id);
        
        if (activeDevice != null) {
            activeDevice.connect(new OnDeviceStateChangeListener() {
                @Override
                public void onConnected(@NonNull IDeviceCompat sender) {
                    JSObject ret = new JSObject();
                    ret.put("connected", true);
                    notifyListeners("deviceConnected", ret);
                }

                @Override
                public void onDisconnected(@NonNull IDeviceCompat sender, @NonNull DeviceStatus status) {
                    notifyListeners("deviceDisconnected", new JSObject());
                }

                @Override
                public void onBatteryStateChanged(@NonNull IDeviceCompat sender, int newState) {}

                @Override
                public void onExtPowerStateChanged(@NonNull IDeviceCompat sender, boolean newState) {}
            });
            call.resolve();
        } else {
            call.reject("Dispositivo no encontrado o no escaneado previamente");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (activeDevice != null) {
            activeDevice.disconnect();
        }
        call.resolve();
    }

    @PluginMethod
    public void measure(PluginCall call) {
        if (activeDevice == null || activeDevice.getState() != DeviceState.IDLE) {
            call.reject("Dispositivo no listo o no conectado");
            return;
        }

        activeDevice.measure(new OnDeviceResultListener() {
            @Override
            public void onDeviceResult(@NonNull CommandStatus status, @Nullable Map<ScanMode, ? extends IMeasurementData> results) {
                if (status == CommandStatus.SUCCESS && results != null) {
                    IMeasurementData mData = results.values().iterator().next();
                    if (mData != null) {
                        IColorData color = mData.toColorData(ReferenceWhite.D50_2, IColorData.ColorType.CIELAB);

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
        });
    }
}
