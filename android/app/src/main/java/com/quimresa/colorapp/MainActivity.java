package com.quimresa.colorapp;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NixSensorPlugin.class);
        registerPlugin(ScreenBrightnessPlugin.class);
        super.onCreate(savedInstanceState);
        // Permite autoplay con sonido en el WebView: necesario para que el
        // video de introduccion (logoQuimresa.mp4) suene desde el inicio sin
        // esperar a un gesto del usuario.
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
        android.util.Log.d("QuimresaApp", "NixSensorPlugin y ScreenBrightnessPlugin registrados con éxito");
    }
}
