package com.nixsensor.nixexample.fragment

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import androidx.fragment.app.activityViewModels
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.adapter.BottomSheetListAdapter
import com.nixsensor.nixexample.databinding.FragmentBottomSheetOptionsBinding
import com.nixsensor.nixexample.viewmodel.ConnectedDeviceViewModel
import com.nixsensor.nixexample.viewmodel.MeasurementViewModel
import com.nixsensor.universalsdk.CommandStatus
import com.nixsensor.universalsdk.IDeviceCompat
import com.nixsensor.universalsdk.OnDeviceResultListener
import com.nixsensor.universalsdk.ScanMode
import com.nixsensor.universalsdk.IMeasurementData
import com.nixsensor.universalsdk.LicenseManager
import com.nixsensor.universalsdk.LicenseManagerState
import java.text.SimpleDateFormat
import java.util.*
import kotlin.collections.ArrayList

class BottomSheetListFragment : BottomSheetDialogFragment() {
    companion object {
        private const val TAG = "BottomSheetListFragment"
        private const val ARG_LIST_TYPE = "list_type"
        const val LIST_TYPE_DEVICE_OPTIONS = 0
        const val LIST_TYPE_REFERENCE_WHITE_OPTIONS = 1
        const val LIST_TYPE_SCAN_INFO = 2
        const val LIST_TYPE_DEVICE_INFO = 3
        const val LIST_TYPE_LICENSE_INFO = 4

        fun newInstance(type: Int): BottomSheetListFragment {
            val args = Bundle()
            when (type) {
                LIST_TYPE_DEVICE_OPTIONS,
                LIST_TYPE_REFERENCE_WHITE_OPTIONS,
                LIST_TYPE_SCAN_INFO,
                LIST_TYPE_DEVICE_INFO,
                LIST_TYPE_LICENSE_INFO -> args.putInt(ARG_LIST_TYPE, type)
            }

            val fragment = BottomSheetListFragment()
            fragment.arguments = args
            return fragment
        }
    }

    class SimpleOptionsItem(
        val type: Int,
        val title: String?,
        val subtitle: String? = null,
        var checked: Boolean? = false,
        var enabled: Boolean = false,
        val id: Int? = null
    )

    // Data binding
    private var _binding: FragmentBottomSheetOptionsBinding? = null
    private val binding get() = _binding!!

    // List type
    private var _type = -1
    private val _list: ArrayList<SimpleOptionsItem> = ArrayList()
    var listEnabled: Boolean = true
        set(value) {
            field = value
            binding.optionsListView.itemsCanFocus = value
            binding.optionsListView.isFocusable = value
            binding.optionsListView.isFocusableInTouchMode = value
        }

    // View models
    private val measurementViewModel: MeasurementViewModel by activityViewModels()
    private val deviceViewModel: ConnectedDeviceViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Inflate the layout for this fragment
        _binding = FragmentBottomSheetOptionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Read arguments
        arguments?.let { readArguments(it) }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        return BottomSheetDialog(requireContext(), R.style.BottomSheetDialogTheme)
    }

    private fun readArguments(args: Bundle) {
        _type = args.getInt(ARG_LIST_TYPE, -1)
        when (_type) {
            LIST_TYPE_DEVICE_OPTIONS ->             initDeviceOptionsList()
            LIST_TYPE_REFERENCE_WHITE_OPTIONS ->    initReferenceWhiteList()
            LIST_TYPE_SCAN_INFO ->                  initScanInfoList()
            LIST_TYPE_DEVICE_INFO ->                initDeviceInfoList()
            LIST_TYPE_LICENSE_INFO ->               initLicenseInfoList()
        }
    }

    private fun initDeviceOptionsList() {
        if (_type != LIST_TYPE_DEVICE_OPTIONS) return

        // Set list title and clear the list
        binding.headerLineLabel.text = getString(R.string.title_device_settings)
        _list.clear()

        // Get list of supported options from the connected device
        val device = deviceViewModel.getDevice().value ?: return

        if (device.supportsRgbFeedback) {
            _list.add(
                SimpleOptionsItem(
                    type = _type,
                    id = R.string.title_rgb_feedback,
                    title = getString(R.string.title_rgb_feedback),
                    checked = device.rgbFeedbackEnabled,
                    enabled = true
                )
            )
        }

        if (device.supportsHapticFeedback) {
            _list.add(
                SimpleOptionsItem(
                    type = _type,
                    id = R.string.title_haptic_feedback,
                    title = getString(R.string.title_haptic_feedback),
                    checked = device.hapticFeedbackEnabled,
                    enabled = true
                )
            )
        }

        if (device.supportsFieldCalibration) {
            _list.add(
                SimpleOptionsItem(
                    type = _type,
                    id = R.string.title_white_tile_normalization,
                    title = getString(R.string.title_white_tile_normalization),
                    checked = device.fieldCalibrationEnabled,
                    enabled = true
                )
            )
        }

        if (device.supportsTemperatureCompensation) {
            _list.add(
                SimpleOptionsItem(
                    type = _type,
                    id = R.string.title_temperature_compensation,
                    title = getString(R.string.title_temperature_compensation),
                    checked = device.temperatureCompensationEnabled,
                    enabled = true
                )
            )
        }

        // Create an adapter and set to the list
        val adapter = BottomSheetListAdapter(
            requireContext(),
            R.layout.cell_with_subtitle_and_end_icon,
            _list
        )
        binding.optionsListView.adapter = adapter

        // Set OnItemClickListener
        binding.optionsListView.onItemClickListener =
            AdapterView.OnItemClickListener { _, _, position, _ ->
                val item = _list[position]

                // Prevent the list from being clicked during update and set checked state to null
                // Adapter will show progress indicator when checked state is null
                val isChecked = item.checked ?: false
                item.checked = null

                // Prevent list clicks
                listEnabled = false

                // Define item callback
                val listener = object : OnDeviceResultListener {
                    override fun onDeviceResult(
                        status: CommandStatus,
                        measurements: Map<ScanMode, IMeasurementData>?
                    ) {
                        // Update item status
                        when (item.id) {
                            R.string.title_rgb_feedback -> {
                                item.checked = device.rgbFeedbackEnabled
                            }
                            R.string.title_haptic_feedback -> {
                                item.checked = device.hapticFeedbackEnabled
                            }
                            R.string.title_white_tile_normalization -> {
                                item.checked = device.fieldCalibrationEnabled
                            }
                            R.string.title_temperature_compensation -> {
                                item.checked = device.temperatureCompensationEnabled
                            }
                        }

                        // Allow list to be clicked
                        listEnabled = true

                        // Update list
                        adapter.notifyDataSetChanged()
                    }
                }

                // Update the adapter
                adapter.notifyDataSetChanged()

                // Toggle the setting
                when (item.id) {
                    R.string.title_rgb_feedback ->
                        device.setRgbFeedbackEnabled(listener, !isChecked)
                    R.string.title_haptic_feedback ->
                        device.setHapticFeedbackEnabled(listener, !isChecked)
                    R.string.title_white_tile_normalization ->
                        device.setFieldCalibrationEnabled(listener, !isChecked)
                    R.string.title_temperature_compensation ->
                        device.setTemperatureCompensationEnabled(listener, !isChecked)
                }
            }

    }

    private fun initReferenceWhiteList() {
        if (_type != LIST_TYPE_REFERENCE_WHITE_OPTIONS) return

        // Set list title
        binding.headerLineLabel.text = getString(R.string.title_reference_white)

        // Get list of supported reference white settings from the last measurement
        // Fall back to empty list if no measurement is available
        val modes = measurementViewModel.getMeasurement().value?.supportedReferences ?: arrayOf()
        val selectedMode = measurementViewModel.getReference().value ?: MeasurementViewModel.DEFAULT_REFERENCE

        // Fill out list
        _list.clear()
        for (mode in modes)
            _list.add(
                SimpleOptionsItem(
                    type = LIST_TYPE_REFERENCE_WHITE_OPTIONS,
                    title = mode.fullName,
                    checked = mode == selectedMode,
                    enabled = true
                )
            )

        // Create an adapter and set to the list
        binding.optionsListView.adapter = BottomSheetListAdapter(
            requireContext(),
            R.layout.cell_with_subtitle_and_end_icon,
            _list
        )

        // Set OnItemClickListener
        binding.optionsListView.onItemClickListener =
            AdapterView.OnItemClickListener { _, _, position, _ ->
                measurementViewModel.setReference(modes[position])
                dismiss()
            }
    }

    private fun initScanInfoList() {
        if (_type != LIST_TYPE_SCAN_INFO) return

        // Get latest measurement
        val measurement = measurementViewModel.getMeasurement().value ?: return

        // Set the list title
        binding.headerLineLabel.text = getString(R.string.title_scan_info)

        // Fill out the list
        _list.clear()

        // Device Name / Type
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_device_name),
                subtitle = measurement.deviceType.fullName
            )
        )

        // Reference temperature
        val tFormat =
            if (measurement.tReal == true)
                R.string.temperature_format_celsius
            else
                R.string.temperature_format_raw

        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_temperature_reference),
                subtitle =
                    if (measurement.tRef == null)
                        getString(R.string.status_unavailable)
                    else
                        getString(tFormat, measurement.tRef)
            )
        )

        // Scan temperature
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_temperature_scan),
                subtitle =
                    if (measurement.tRef == null)
                        getString(R.string.status_unavailable)
                    else
                        getString(tFormat, measurement.tScan)
            )
        )

        // Temperature compensation enabled
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_temperature_compensation),
                subtitle = when (measurement.tCompEnabled) {
                    true -> getString(R.string.status_enabled)
                    false -> getString(R.string.status_disabled)
                    null -> getString(R.string.status_unavailable)
                }
            )
        )

        // Tile enabled
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_white_tile_normalization),
                subtitle = when (measurement.tileEnabled) {
                    true -> getString(R.string.status_enabled)
                    false -> getString(R.string.status_disabled)
                    null -> getString(R.string.status_unavailable)
                }
            )
        )

        // Create an adapter and set to the list
        binding.optionsListView.adapter = BottomSheetListAdapter(
            requireContext(),
            R.layout.cell_with_subtitle_and_end_icon,
            _list
        )
    }

    private fun initDeviceInfoList() {
        // Add observers
        deviceViewModel.getDevice().observe(viewLifecycleOwner) { device ->
            updateDeviceInfoList(device)
        }
        deviceViewModel.getBatteryState().observe(viewLifecycleOwner) {
            deviceViewModel.getDevice().value?.let { device -> updateDeviceInfoList(device) }
        }
        deviceViewModel.getExtPowerState().observe(viewLifecycleOwner) {
            deviceViewModel.getDevice().value?.let { device -> updateDeviceInfoList(device) }
        }

        deviceViewModel.getDevice().value?.let { updateDeviceInfoList(it) }
    }

    private fun updateDeviceInfoList(device: IDeviceCompat) {
        if (_type != LIST_TYPE_DEVICE_INFO) return

        // Set the list title
        binding.headerLineLabel.text = getString(R.string.action_device_info)

        // Fill out the list
        _list.clear()

        // Device Name
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_device_name),
                subtitle = device.name
            )
        )
        // Hardware Version
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_device_hardware),
                subtitle = device.hardwareVersion.string.ifEmpty {
                    getString(R.string.status_unavailable)
                }
            )
        )
        // Firmware Version
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_device_firmware),
                subtitle = device.firmwareVersion.string.ifEmpty {
                    getString(R.string.status_unavailable)
                }
            )
        )
        // Serial Number
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_serial_number),
                subtitle = device.serialNumber.ifEmpty {
                    getString(R.string.status_unavailable)
                }
            )
        )
        // Battery Level
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_battery_level),
                subtitle =
                    if (device.batteryLevel == null) {
                        getString(R.string.status_unavailable)
                    } else {
                        "${device.batteryLevel}%"
                    }
            )
        )
        // External Power Connected
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_SCAN_INFO,
                title = getString(R.string.title_usb_connected),
                subtitle =
                    if (device.extPowerState)
                        getString(R.string.title_true)
                    else
                        getString(R.string.title_false)
            )
        )
        // Scan Counter
        device.scanCount?.let { scanCount ->
            _list.add(
                SimpleOptionsItem(
                    type = LIST_TYPE_SCAN_INFO,
                    title = getString(R.string.title_scan_counter),
                    subtitle = "$scanCount"
                )
            )
        }

        // Field Calibration Date / Field Calibration Due
        device.referenceDate?.let { date ->
            val formatter = SimpleDateFormat("yyyy-MMM-dd HH:mm:ss Z", Locale.CANADA)
            val dateString =
                if (date.time > 0)
                    formatter.format(date)
                else
                    getString(R.string.status_unavailable)
            // Field Calibration Date item
            _list.add(
                SimpleOptionsItem(
                    type = LIST_TYPE_SCAN_INFO,
                    title = getString(R.string.title_field_calibration_date),
                    subtitle = dateString
                )
            )

            // Field Calibration Due item
            _list.add(
                SimpleOptionsItem(
                    type = LIST_TYPE_SCAN_INFO,
                    title = getString(R.string.title_field_calibration_due),
                    subtitle =
                        if (device.fieldCalibrationDue)
                            getString(R.string.title_true)
                        else
                            getString(R.string.title_false)
                )
            )
        }

        // Create an adapter and set to the list
        binding.optionsListView.adapter = BottomSheetListAdapter(
            requireContext(),
            R.layout.cell_with_subtitle_and_end_icon,
            _list
        )
    }

    private fun initLicenseInfoList() {
        if (_type != LIST_TYPE_LICENSE_INFO) return

        // Set the list title
        binding.headerLineLabel.text = getString(R.string.title_license_info)

        // Fill out the list
        _list.clear()

        // License state
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_LICENSE_INFO,
                title = getString(R.string.title_license_state),
                subtitle = LicenseManager.state.name
            )
        )

        when (LicenseManager.state) {
            LicenseManagerState.ACTIVE,
            LicenseManagerState.ERROR_LICENSE_EXPIRED -> {
                // Valid states to list further license details

                // UUID
                val uuidString = LicenseManager.uuid.ifBlank { getString(R.string.status_unavailable) }
                _list.add(
                    SimpleOptionsItem(
                        type = LIST_TYPE_LICENSE_INFO,
                        title = getString(R.string.title_license_uuid),
                        subtitle = uuidString
                    )
                )

                // Expiry
                val formatter = SimpleDateFormat("yyyy-MMM-dd HH:mm:ss Z", Locale.CANADA)
                val dateString = if (LicenseManager.expiry.time > 0)
                    formatter.format(LicenseManager.expiry)
                else
                    getString(R.string.status_unavailable)
                _list.add(
                    SimpleOptionsItem(
                        type = LIST_TYPE_LICENSE_INFO,
                        title = getString(R.string.title_license_expiry),
                        subtitle = dateString
                    )
                )

                // Allocations
                if (LicenseManager.allocations.isNotEmpty()) {
                    _list.add(
                        SimpleOptionsItem(
                            type = LIST_TYPE_LICENSE_INFO,
                            title = getString(R.string.title_license_allocation),
                            subtitle = LicenseManager.allocations.joinToString { it }
                        )
                    )
                }

                // Allowed devices
                val devicesString = LicenseManager.allowedDeviceTypes.joinToString {
                    it.name
                }.ifBlank {
                    getString(R.string.status_unavailable)
                }
                _list.add(
                    SimpleOptionsItem(
                        type = LIST_TYPE_LICENSE_INFO,
                        title = getString(R.string.title_license_device_types),
                        subtitle = devicesString
                    )
                )

                // Features
                val featuresString = LicenseManager.features.joinToString {
                    it.name
                }.ifEmpty {
                    getString(R.string.status_unavailable)
                }
                _list.add(
                    SimpleOptionsItem(
                        type = LIST_TYPE_LICENSE_INFO,
                        title = getString(R.string.title_license_features),
                        subtitle = featuresString
                    )
                )
            }
            LicenseManagerState.INACTIVE,
            LicenseManagerState.ERROR_LICENSE_BAD_SIGNATURE,
            LicenseManagerState.ERROR_LICENSE_INVALID_OPTIONS,
            LicenseManagerState.ERROR_INTERNAL  -> {
                // Nothing else to report from the license manager
            }
        }

        // SDK version
        _list.add(
            SimpleOptionsItem(
                type = LIST_TYPE_LICENSE_INFO,
                title = getString(R.string.title_license_sdk_version),
                subtitle = LicenseManager.libraryVersion
            )
        )

        // Create an adapter and set to the list
        binding.optionsListView.adapter = BottomSheetListAdapter(
            requireContext(),
            R.layout.cell_with_subtitle_and_end_icon,
            _list
        )
    }
}