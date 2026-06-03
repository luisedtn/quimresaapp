package com.quimresa.colorapp;

import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenBrightness")
public class ScreenBrightnessPlugin extends Plugin {

    @PluginMethod
    public void setBrightness(PluginCall call) {
        Float brightness = call.getFloat("brightness");
        if (brightness == null) {
            call.reject("brightness parameter required (0.0 - 1.0)");
            return;
        }
        getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams lp = getActivity().getWindow().getAttributes();
            lp.screenBrightness = brightness;
            getActivity().getWindow().setAttributes(lp);
            call.resolve();
        });
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        float current = getActivity().getWindow().getAttributes().screenBrightness;
        JSObject ret = new JSObject();
        ret.put("brightness", current);
        call.resolve(ret);
    }
}
