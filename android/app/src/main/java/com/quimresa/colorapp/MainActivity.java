package com.quimresa.colorapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NixSensorPlugin.class);
        registerPlugin(ScreenBrightnessPlugin.class);
        super.onCreate(savedInstanceState);
        android.util.Log.d("QuimresaApp", "NixSensorPlugin y ScreenBrightnessPlugin registrados con éxito");
    }
}
