package com.nixsensor.nixexample.fragment

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.Navigation.findNavController
import com.google.android.material.snackbar.BaseTransientBottomBar
import com.google.android.material.snackbar.Snackbar
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.databinding.FragmentTileDecodeBinding
import com.nixsensor.nixexample.util.mlkit.BarcodeScannerProcessor
import com.nixsensor.nixexample.util.mlkit.CameraSource
import com.nixsensor.nixexample.util.mlkit.GraphicOverlay
import com.nixsensor.nixexample.viewmodel.TileDecodeViewModel
import java.io.IOException

class TileDecodeFragment : Fragment() {
    companion object {
        private const val TAG = "TileDecodeFragment"
    }

    // Data binding
    private var _binding: FragmentTileDecodeBinding? = null
    private val binding get() = _binding!!

    // Camera and decoder resources
    private var _hasDecoded: Boolean = false
    private var _cameraSource: CameraSource? = null
    private var _barcodeScannerProcessor: BarcodeScannerProcessor? = null

    // View elements
    private var _snackbar: Snackbar? = null

    // View models
    private val tileDecodeViewModel: TileDecodeViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        // Inflate the layout for this fragment
        _binding = FragmentTileDecodeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onResume() {
        super.onResume()

        // Show snackbar with instructions
        _snackbar?.dismiss()
        _snackbar = Snackbar.make(requireView(), R.string.hint_qr_code, Snackbar.LENGTH_INDEFINITE)
        _snackbar?.animationMode = BaseTransientBottomBar.ANIMATION_MODE_SLIDE
        _snackbar?.setAction(R.string.action_cancel) {
            // Dismiss
            findNavController(requireView()).navigateUp()
        }
        _snackbar?.show()

        // Restarts the camera
        try {
            Thread(_messageSender).start()
        } catch (e: Exception) {
            Log.e(TAG, "Could not create the camera source")
            e.printStackTrace()
        }
    }

    override fun onPause() {
        super.onPause()

        // Stops the camera
        binding.preview.stop()

        // Dismiss the snackbar
        _snackbar?.dismiss()
    }

    override fun onDestroy() {
        super.onDestroy()

        // Released resources associated with the camera source, the associated detector, and the
        // rest of the processing pipeline
        _cameraSource?.release()
        binding.preview.release()
    }

    // region Camera and decoder methods
    private val _barcodeResultListener = object : BarcodeScannerProcessor.BarcodeResultListener {
        override fun onSuccess(barcodes: MutableList<Barcode>, graphicOverlay: GraphicOverlay) {
            if (barcodes.isEmpty() || _hasDecoded) return

            // Examine first barcode only
            //val barcode = barcodes[0]
            barcodes[0].rawValue?.let { decodedString ->
                // Stop the camera
                _hasDecoded = true
                binding.preview.stop()

                // Send the decoded string to the view model
                tileDecodeViewModel.setTileString(decodedString)

                // Dismiss this fragment
                findNavController(requireView()).navigateUp()
            }
        }

        override fun onFailure(e: Exception) {
            // Keep trying ...
        }
    }

    private fun createCameraSource() {
        // Initialize the QR code detector
        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()

        // Connect the camera resource with the detector
        _barcodeScannerProcessor = BarcodeScannerProcessor(requireContext(), options)
        _barcodeScannerProcessor?.barcodeResultListener = _barcodeResultListener
        _cameraSource = CameraSource(requireActivity(), binding.barcodeOverlay)
        _cameraSource?.setFacing(CameraSource.CAMERA_FACING_BACK)
        _cameraSource?.setMachineLearningFrameProcessor(_barcodeScannerProcessor)
        startCameraSource()
    }

    private fun startCameraSource() {
        try {
            binding.preview.start(_cameraSource, binding.barcodeOverlay)
        } catch (ioe: IOException) {
            Log.d(TAG, "Unable to start camera source")
            _cameraSource?.release()
            _cameraSource = null
            onCameraException(ioe)
        } catch (re: RuntimeException) {
            Log.e(TAG, "Unable to start camera source; permission not granted?")
            onCameraException(re)
        }
    }

    private fun onCameraException(e: java.lang.Exception) {
        e.printStackTrace()
        _snackbar?.dismiss()
        _snackbar = Snackbar.make(requireView(), R.string.message_camera_error, Snackbar.LENGTH_INDEFINITE)
        _snackbar?.animationMode = BaseTransientBottomBar.ANIMATION_MODE_SLIDE
        _snackbar?.setAction(R.string.action_abort) {
            // Dismiss
            findNavController(it).navigateUp()
        }
        _snackbar?.show()
    }

    private val _handler: Handler = object : Handler(Looper.getMainLooper()) {
        override fun handleMessage(msg: Message) {
            createCameraSource()
        }
    }

    private val _messageSender = Runnable {
        val msg = _handler.obtainMessage()
        val bundle = Bundle()
        msg.data = bundle
        _handler.sendMessage(msg)
    }
    // endregion
}