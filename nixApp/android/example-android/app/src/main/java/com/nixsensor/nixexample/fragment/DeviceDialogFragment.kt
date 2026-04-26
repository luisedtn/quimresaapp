package com.nixsensor.nixexample.fragment

import android.app.Dialog
import android.content.DialogInterface
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.AdapterView
import android.widget.ListView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.nixsensor.nixexample.adapter.DeviceAdapter
import com.nixsensor.universalsdk.DeviceScanner

import com.nixsensor.nixexample.R
import com.nixsensor.universalsdk.IDeviceCompat
import com.nixsensor.universalsdk.IDeviceScanner
import com.nixsensor.universalsdk.IDeviceScanner.*

/**
 * Fragment to present the list of discovered nearby devices. A [DeviceScanner] is
 * started when this fragment is resumed and discovered devices are shown in the list.  When a list
 * item is selected, the [DeviceScanner] is stopped and the selected device is passed back
 * via the [DeviceDialogListener.onDeviceSelected] callback.
 */
class DeviceDialogFragment : DialogFragment(), AdapterView.OnItemClickListener {
    companion object {
        private val TAG: String = DeviceDialogFragment::class.java.simpleName
    }

    interface DeviceDialogListener {
        fun onDeviceSelected(device: IDeviceCompat)
        fun onError(errorState: DeviceScannerState)
    }

    var deviceDialogListener: DeviceDialogListener? = null

    private val _devices = HashMap<String, IDeviceCompat>()
    private val devices: List<IDeviceCompat>
        get() = _devices.values.sortedDescending()
    private var _scanner: DeviceScanner? = null
    private var _adapter: DeviceAdapter? = null
    private var _listView: ListView? = null
    private var _progressBar: ProgressBar? = null
    private var _tvWarning: TextView? = null

    private val _scannerStateListener = object : OnScannerStateChangeListener {
        override fun onScannerStarted(sender: IDeviceScanner) {
            Log.d(TAG, "onScannerStarted()")
        }

        override fun onScannerStopped(sender: IDeviceScanner) {
            Log.d(TAG, "onScannerStopped()")

            // If the timer finishes without any devices being found, show message in dialog
            if (_devices.isEmpty()) {
                _progressBar?.visibility = View.INVISIBLE
                _tvWarning?.visibility = View.VISIBLE
            }
        }
    }

    private val _deviceFoundListener = object : OnDeviceFoundListener {
        override fun onScanResult(sender: IDeviceScanner, device: IDeviceCompat) {
            Log.d(TAG, String.format("Found %s (%s) at RSSI %d", device.id, device.name, device.rssi))

            // Update device in list
            _devices[device.id] = device

            // Notify the adapter to update the list
            _adapter?.devices = devices
            _adapter?.notifyDataSetChanged()

            // Found at least one device, so hide the progress bar and show the list
            if (_progressBar?.visibility != View.INVISIBLE)
                _progressBar?.visibility = View.INVISIBLE
            if (_listView?.visibility != View.VISIBLE)
                _listView?.visibility = View.VISIBLE
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        // Inflate view and look up elements
        val view = layoutInflater.inflate(R.layout.fragment_device_dialog, null)
        _listView = view.findViewById(R.id.discovered_devices)
        _progressBar = view.findViewById(R.id.searching)
        _tvWarning = view.findViewById(R.id.no_device_found)

        _adapter = DeviceAdapter(devices)
        _listView?.adapter = _adapter
        _listView?.onItemClickListener = this@DeviceDialogFragment

        context?.let {
            _scanner = DeviceScanner(it)
            if (_scanner?.state == DeviceScannerState.SCANNING)
                _scanner?.stop()
        }

        val builder = AlertDialog.Builder(requireActivity())
        builder.setTitle(R.string.title_device_list_searching)
            .setCancelable(false)
            .setNegativeButton(R.string.action_cancel) { _, _ -> _scanner?.stop() }
            .setView(view)

        _scanner?.setOnScannerStateChangeListener(_scannerStateListener)
        startScan()

        return builder.create()
    }

    override fun onItemClick(p0: AdapterView<*>?, p1: View?, position: Int, id: Long) {
        _scanner?.stop()
        _adapter?.getItem(position)?.let { deviceDialogListener?.onDeviceSelected(it) }
        dismiss()
    }

    override fun onDismiss(dialog: DialogInterface) {
        super.onDismiss(dialog)
        _scanner?.stop()
    }

    private fun startScan() {
        _devices.clear()
        _adapter?.notifyDataSetChanged()
        _scanner?.start(_deviceFoundListener)

        // If the scanner has not started properly, a dialog is presented to the user
        val state = _scanner?.state ?: DeviceScannerState.ERROR_INTERNAL
        if (state != DeviceScannerState.SCANNING) {
            dismiss()
            deviceDialogListener?.onError(state)
        }
    }
}