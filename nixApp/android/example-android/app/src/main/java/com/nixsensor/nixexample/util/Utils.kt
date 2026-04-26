package com.nixsensor.nixexample.util

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.TypedValue
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import kotlin.math.pow

class Utils {
    companion object {
        fun getThemeColor(context: Context?, attribute: Int): Int {
            val typedValue = TypedValue()
            context?.theme?.resolveAttribute(attribute, typedValue, true) ?: return 0
            return typedValue.data
        }

        /**
         * Determines whether overlay text on a specified color should be black or white
         */
        fun colorForOverlayText(@ColorInt colorInt: Int): Int {
            // Convert input color sRGB to linear RGB
            val rgbLinear = DoubleArray(3)
            for (i in 0..2) {
                var c = 0.0
                when (i) {
                    0 -> c = Color.red(colorInt).toDouble()
                    1 -> c = Color.green(colorInt).toDouble()
                    2 -> c = Color.blue(colorInt).toDouble()
                }
                c /= 255.0
                c = if (c <= 0.03928) {
                    c / 12.92
                } else {
                    ((c + 0.055) / 1.055).pow(2.4)
                }
                rgbLinear[i] = c
            }

            // Compute luminance
            val l = 0.2126 * rgbLinear[0] + 0.7152 * rgbLinear[1] + 0.0722 * rgbLinear[2]

            return if (l > 0.179) {
                // Overlay text should be black
                Color.parseColor("#000000")
            } else {
                // Overlay text color should be white
                Color.parseColor("#FFFFFF")
            }
        }

        fun isCameraPermissionGranted(context: Context?): Boolean {
            val safeContext = context ?: return false

            return ContextCompat.checkSelfPermission(
                safeContext,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        }

//        /**
//         * Requests permissions required for using the camera. Use this when calling from an Activity.
//         * @param activity Activity which is making the permission request
//         */
//        fun requestCameraPermission(activity: Activity?, requestCode: Int) {
//            activity?.let {
//                ActivityCompat.requestPermissions(
//                    it,
//                    arrayOf(Manifest.permission.CAMERA),
//                    requestCode
//                )
//            }
//        }

//        /**
//         * Requests permissions required for using the camera. Use this when calling from a Fragment.
//         * @param fragment Fragment which is making the permission request
//         */
//        fun requestCameraPermission(fragment: Fragment?, requestCode: Int) {
//            fragment?.requestPermissions(
//                arrayOf(Manifest.permission.CAMERA),
//                requestCode
//            )
//        }

        fun launchSettingsIntent(activity: Activity?) {
            val safeActivity = activity ?: return
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val uri = Uri.fromParts("package", safeActivity.packageName, null)
            intent.data = uri
            safeActivity.startActivity(intent)
        }

        private fun getVibratorService(context: Context): Vibrator? {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager =
                    context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager?
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator?
            }
        }

        fun vibrateOnScanStart(context: Context) {
            val vibrator = getVibratorService(context) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Predefined single click effect in SDK 29+
                val vibrationEffect = VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                vibrator.vibrate(vibrationEffect)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Simulated single click effect in SDK 26+
                val pattern = longArrayOf(0, 10)
                val amplitude = intArrayOf(0, 180)
                val vibrationEffect = VibrationEffect.createWaveform(pattern, amplitude, -1)
                vibrator.vibrate(vibrationEffect)
            } else {
                // Basic single vibration in SDK < 26
                @Suppress("DEPRECATION")
                vibrator.vibrate(100)
            }
        }

        fun vibrateOnScanComplete(context: Context) {
            val vibrator = getVibratorService(context) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Predefined double click effect in SDK 29+
                val vibrationEffect = VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                vibrator.vibrate(vibrationEffect)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Simulated double click effect in SDK 26+
                val pattern = longArrayOf(0, 10, 160, 10)
                val amplitude = intArrayOf(0, 255, 0, 255)
                val vibrationEffect = VibrationEffect.createWaveform(pattern, amplitude, -1)
                vibrator.vibrate(vibrationEffect)
            } else {
                // Basic double vibration in SDK < 26
                val pattern = longArrayOf(0, 100, 50, 100)
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        }
    }
}