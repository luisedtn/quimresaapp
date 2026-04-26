package com.nixsensor.nixexample.fragment

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.*
import android.view.ViewGroup.MarginLayoutParams
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.view.MenuHost
import androidx.core.view.MenuProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.iterator
import androidx.core.view.updateLayoutParams
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.navigation.Navigation
import com.google.android.material.snackbar.BaseTransientBottomBar
import com.google.android.material.snackbar.Snackbar
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.databinding.FragmentHomeBinding
import com.nixsensor.nixexample.util.Utils
import com.nixsensor.nixexample.viewmodel.ConnectedDeviceViewModel
import com.nixsensor.nixexample.viewmodel.MeasurementViewModel
import com.nixsensor.nixexample.viewmodel.TileDecodeViewModel
import com.nixsensor.universalsdk.*
import com.nixsensor.universalsdk.IDeviceCompat.OnDeviceStateChangeListener
import com.nixsensor.universalsdk.IDeviceScanner.DeviceScannerState.*
import com.nixsensor.universalsdk.IMeasurementData
import java.util.*

/**
 * Fragment which presents the main interface for the app and contains the scan interface.
 */
class HomeFragment : Fragment(), MenuProvider, OnDeviceStateChangeListener {
    companion object {
        private const val TAG = "HomeFragment"
    }

    // Data binding
    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    // View elements
    private var _snackbar: Snackbar? = null

    // View models
    private val measurementViewModel: MeasurementViewModel by activityViewModels()
    private val deviceViewModel: ConnectedDeviceViewModel by activityViewModels()
    private val tileDecodeViewModel: TileDecodeViewModel by activityViewModels()

    // Nix device
    private var _device: IDeviceCompat? = null
    private val deviceState: DeviceState
        get() = _device?.state ?: DeviceState.DISCONNECTED

    // Scanned data
    private var _measurementMap: Map<ScanMode, IMeasurementData> = EnumMap(ScanMode::class.java)
    private var _displayedMode = ScanMode.NA
    private val _isDisplayedModeAvailable: Boolean
        get() = _measurementMap.containsKey(_displayedMode)

    // region MenuProvider
    override fun onCreateMenu(menu: Menu, menuInflater: MenuInflater) {
        // Inflate the menu
        menuInflater.inflate(R.menu.menu_home, menu)

        // Hide device buttons if disconnected
        for (menuItem in menu) {
            menuItem.isVisible = when (menuItem.itemId) {
                // Always show license items
                R.id.action_license_info, R.id.action_license_change -> {
                   true
                }
                // Other items are only visible when the device is connected and idle
                else -> {
                    if (_device?.state == DeviceState.IDLE) {
                        // Only show calibrate and settings items if supported
                        when (menuItem.itemId) {
                            R.id.action_calibrate -> {
                                _device?.supportsFieldCalibration ?: false
                            }
                            R.id.action_settings -> {
                                _device?.hasOptions ?: false
                            }
                            else -> {
                                true
                            }
                        }
                    } else {
                        false
                    }
                }
            }
        }
    }

    override fun onMenuItemSelected(menuItem: MenuItem): Boolean {
        return when (menuItem.itemId) {
            R.id.action_calibrate -> onCalibrateClicked()
            R.id.action_settings -> onDeviceSettingsClicked()
            R.id.action_device -> onDeviceInfoClicked()
            R.id.action_disconnect -> onDisconnectClicked()
            R.id.action_license_info -> onLicenseInfoClicked()
            R.id.action_license_change -> onLicenseChangeClicked()
            else -> false
        }
    }
    // endregion

    // region Additional menu helpers
    private fun createOptionsMenu() {
        // Remove existing menu
        removeOptionsMenu()

        // Create new menu
        (requireActivity() as MenuHost).addMenuProvider(
            this,
            viewLifecycleOwner,
            Lifecycle.State.RESUMED
        )
    }

    private fun removeOptionsMenu() {
        (requireActivity() as MenuHost).removeMenuProvider(this)
    }
    // endregion

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Inflate the layout for this fragment
        if (_binding == null) {
            _binding = FragmentHomeBinding.inflate(inflater, container, false)
            init()
        }

        // API 35+: edge-to-edge layout
        // Update bottom margin to prevent drawing underneath bottom bar
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    or WindowInsetsCompat.Type.displayCutout()
            )
            view.updateLayoutParams<MarginLayoutParams> {
                bottomMargin = bars.bottom
            }
            WindowInsetsCompat.CONSUMED
        }

        return binding.root
    }

    override fun onResume() {
        super.onResume()

        // Options menu is removed automatically when fragment is paused
        // Recreate it here
        createOptionsMenu()
    }

    private fun init() {
        retainInstance = true

        // Set up buttons
        setButtonsForState(DeviceState.DISCONNECTED)
        binding.bottomButton1.setOnClickListener {
            if (deviceState == DeviceState.IDLE) onScanClicked() else onConnectBleClicked()
        }
        binding.modeSelectionGroup.setOnCheckedChangeListener(_modeCheckedChangeListener)

        // Style the radio buttons
        initModeRadioButtons()
    }

    private fun setButtonsForState(state: DeviceState) {
        when (state) {
            DeviceState.DISCONNECTED -> {
                // Disconnected
                binding.activityProgressBar.visibility = View.INVISIBLE
                binding.bottomButton1.text = getString(R.string.action_connect)
                binding.bottomButton1.visibility = View.VISIBLE
            }
            DeviceState.IDLE -> {
                // Connected and idle
                binding.activityProgressBar.visibility = View.INVISIBLE
                binding.bottomButton1.text = getString(R.string.action_scan)
                binding.bottomButton1.visibility = View.VISIBLE
            }
            else -> {
                // All other busy states ... hide buttons and show progress indicator
                binding.activityProgressBar.visibility = View.VISIBLE
                binding.bottomButton1.visibility = View.INVISIBLE
            }
        }
    }

    private fun initModeRadioButtons() {
        // Set radio button test
        binding.buttonM0.text = ScanMode.M0.fullName
        binding.buttonM1.text = ScanMode.M1.fullName
        binding.buttonM2.text = ScanMode.M2.fullName

        // Set buttons to be unchecked
        binding.modeSelectionGroup.clearCheck()

        // Set buttons to disabled
        for (mode in ScanMode.entries)
            setModeRadioButtonEnabled(mode, false)
    }

    private fun setModeRadioButtonEnabled(mode: ScanMode, enabled: Boolean) {
        when (mode) {
            ScanMode.M0 -> binding.buttonM0.isEnabled = enabled
            ScanMode.M1 -> binding.buttonM1.isEnabled = enabled
            ScanMode.M2 -> binding.buttonM2.isEnabled = enabled
            else -> { }
        }
    }

    private fun setModeDisplayChecked(mode: ScanMode) {
        val buttonId = when (mode) {
            ScanMode.M0 -> R.id.button_m0
            ScanMode.M1 -> R.id.button_m1
            ScanMode.M2 -> R.id.button_m2
            else -> null
        }
        buttonId?.let { binding.modeSelectionGroup.check(it) }
    }

    private val _modeCheckedChangeListener = RadioGroup.OnCheckedChangeListener { _, id ->
        _displayedMode = when (id) {
            R.id.button_m0 -> ScanMode.M0
            R.id.button_m1 -> ScanMode.M1
            R.id.button_m2 -> ScanMode.M2
            else -> ScanMode.NA
        }

        // Get associated data and update on-screen displays
        if (_displayedMode != ScanMode.NA && _isDisplayedModeAvailable) {
            _measurementMap[_displayedMode]?.let { measurement ->
                // Update scan info via view model
                measurementViewModel.setMeasurement(measurement)
            }
        }
    }

    private fun onConnectBleClicked() {
        // Check if Bluetooth permissions are granted
        if (IDeviceScanner.isBluetoothPermissionGranted(context))
            runDeviceSearchBluetooth()
        else
            requestBluetoothPermission()
    }

    private fun onScanClicked() {
        val device = _device ?: return

        // Haptic feedback
        Utils.vibrateOnScanStart(requireContext())

        // Hide scan buttons during measurement
        setButtonsForState(DeviceState.BUSY_RUNNING_COMMAND)

        // Prevent settings from being opened
        removeOptionsMenu()

        // Show status in snackbar
        showSnackbarMessage(
            getString(R.string.status_scanning),
            Snackbar.LENGTH_INDEFINITE
        )

        // Define callback
        val scanCallback = object : OnDeviceResultListener {
            override fun onDeviceResult(
                status: CommandStatus,
                measurements: Map<ScanMode, IMeasurementData>?
            ) {
                // Restore the options menu
                createOptionsMenu()

                // Haptic feedback
                Utils.vibrateOnScanComplete(requireContext())

                // Handle the result
                this@HomeFragment.handleMeasurementResult(status, measurements)
            }
        }

        // Run the measurement
        device.measure(scanCallback)

        // Note: the above command will report measurements in all supported modes by the device
        // It is also possible to specify specific scan modes. This is usually not necessary. Some
        // cases where this could be desired include :

        // ** On Spectro 2 devices running firmware F1.0.0 **:
        // M0 and M1 are captured in two separate measurements. If only one of M0 or M1 is desired,
        // requesting only one will speed up the scan cycle

        // Specific example cases are listed below:

        // EXAMPLE: request scan only for M2 mode:
        // device.measure(scanCallback, ScanMode.M2)

        // EXAMPLE: request scan for M0 and M1 mode:
        // device.measure(scanCallback, ScanMode.M0, ScanMode.M1)

        // EXAMPLE: request scan for all supported modes:
        // device.measure(scanCallback)
    }

    private fun onCalibrateClicked(): Boolean {
        // Get ready to scan QR code
        if (Utils.isCameraPermissionGranted(context))
            startTileDecode()
        else
            requestCameraPermission()

        return true
    }

    private fun onDeviceInfoClicked(): Boolean {
        val fragment =
            BottomSheetListFragment.newInstance(BottomSheetListFragment.LIST_TYPE_DEVICE_INFO)
        fragment.show(childFragmentManager, fragment.tag)
        return true
    }

    private fun onDeviceSettingsClicked(): Boolean {
        val fragment =
            BottomSheetListFragment.newInstance(BottomSheetListFragment.LIST_TYPE_DEVICE_OPTIONS)
        fragment.show(childFragmentManager, fragment.tag)
        return true
    }

    private fun onDisconnectClicked(): Boolean {
        // Show alert and get user confirmation before disconnecting
        val safeContext = context ?: return false
        AlertDialog.Builder(safeContext)
            .setMessage(R.string.message_confirm_disconnect)
            .setPositiveButton(R.string.action_ok) { _, _ -> _device?.disconnect() }
            .setNegativeButton(R.string.action_cancel) { _, _ -> }
            .show()

        return true
    }

    private fun onLicenseInfoClicked(): Boolean {
        val fragment =
            BottomSheetListFragment.newInstance(BottomSheetListFragment.LIST_TYPE_LICENSE_INFO)
        fragment.show(childFragmentManager, fragment.tag)
        return true
    }

    @SuppressLint("InflateParams")
    private fun onLicenseChangeClicked(): Boolean {
        val safeContext = context ?: return false
        val dialogView = layoutInflater.inflate(
            R.layout.dialog_license_change,
            null)
        val optionsEdit = dialogView.findViewById<EditText>(R.id.options_edit)
        val signatureEdit = dialogView.findViewById<EditText>(R.id.signature_edit)

        AlertDialog.Builder(safeContext)
            .setTitle(R.string.title_license_change)
            .setMessage(getString(R.string.message_license_change, getString(R.string.action_activate)))
            .setView(dialogView)
            .setPositiveButton(R.string.action_activate) { _, _ ->
                // Get user entered values
                val newOptions = optionsEdit?.text ?: ""
                val newSignature = signatureEdit?.text ?: ""

                // Activate
                val newState = LicenseManager.activate(
                    context = safeContext,
                    options = newOptions.toString(),
                    signature = newSignature.toString())

                // Show status in snackbar
                showSnackbarMessage(getString(R.string.message_license_new_state, newState.name))
            }
            .setNegativeButton(R.string.action_cancel) { _, _ -> }
            .show()
        return true
    }

    private fun showSnackbarMessage(message: String, length: Int = Snackbar.LENGTH_LONG) {
        val safeView = view ?: return

        // Dismiss the snackbar if it is showing
        _snackbar?.dismiss()

        // Create and show the new snackbar
        _snackbar = Snackbar.make(safeView, message, length)
        _snackbar?.animationMode = BaseTransientBottomBar.ANIMATION_MODE_SLIDE
        _snackbar?.show()
    }

    private fun handleActivationError() {
        val safeContext = context ?: return

        // Show alert dialog
        val builder = AlertDialog.Builder(safeContext)
        builder.setTitle(R.string.title_activation_error)
            .setMessage(getString(R.string.message_activation_error, LicenseManager.state.name))
            .setCancelable(true)
            .setNegativeButton(R.string.action_cancel) { dialogInterface, _ ->
                dialogInterface.cancel()
            }
        builder.show()
    }

    private fun handleDeviceNotSupportedError(device: IDeviceCompat) {
        val safeContext = context ?: return

        // Show alert dialog
        val builder = AlertDialog.Builder(safeContext)
        builder.setTitle(R.string.title_device_not_supported)
            .setMessage(getString(R.string.message_device_not_supported, device.name))
            .setCancelable(true)
            .setNegativeButton(R.string.action_cancel) { dialogInterface, _ ->
                dialogInterface.cancel()
            }
        builder.show()
    }

    private fun handleUnauthorizedDevice(device: IDeviceCompat) {
        val safeContext = context ?: return

        // Get device serial number and SDK ID for reporting information
        val sdkCheckReport = getString(
            R.string.message_sdk_check_report,
            device.type.fullName,
            device.serialNumber,
            LicenseManager.uuid
        )
        val alertMessage = getString(R.string.message_sdk_check_fail) + "\n\n" + sdkCheckReport

        // Show alert dialog
        val builder = AlertDialog.Builder(safeContext)
        builder.setTitle(R.string.title_device_not_supported)
            .setMessage(alertMessage)
            .setCancelable(true)
            .setPositiveButton(R.string.action_copy) { dialogInterface, _ ->
                dialogInterface.cancel()
                val clipboard: ClipboardManager?
                    = safeContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager?
                clipboard?.setPrimaryClip(
                    ClipData.newPlainText("sdkCheckReport", sdkCheckReport)
                )
            }
            .setNegativeButton(R.string.action_cancel) { dialogInterface, _ ->
                dialogInterface.cancel()
            }
        builder.show()
    }

    private fun handleMeasurementResult(status: CommandStatus, measurements: Map<ScanMode, IMeasurementData>?) {
        // Dismiss the 'scanning' snackbar
        _snackbar?.dismiss()

        when (status) {
            // Scan completed successfully
            CommandStatus.SUCCESS -> {
                // Reset the radio buttons
                initModeRadioButtons()

                // Save the provided values
                if (!measurements.isNullOrEmpty()) {
                    // Save the provided values
                    _measurementMap = measurements

                    // Enable radio buttons for the scan modes included in the measurements
                    measurements.keys.forEach { mode ->
                        setModeRadioButtonEnabled(mode, true)
                    }

                    // Select the first available set of data
                    // This will trigger a screen update
                    setModeDisplayChecked(measurements.keys.first())
                }
            }
            // Scan did not complete due to low battery
            CommandStatus.ERROR_LOW_POWER -> {
                showSnackbarMessage(
                    getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_battery)
                    )
                )
            }
            // Ambient light leakage was detected
            CommandStatus.ERROR_AMBIENT_LIGHT -> {
                showSnackbarMessage(getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_ambient)
                    )
                )
            }
            // Device was running another command
            CommandStatus.ERROR_NOT_READY -> {
                showSnackbarMessage(getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_busy)
                    )
                )
            }
            // Unsupported scan mode was selected
            CommandStatus.ERROR_NOT_SUPPORTED -> {
                showSnackbarMessage(
                    getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_scan_mode)
                    )
                )
            }
            CommandStatus.ERROR_LICENSE -> {
                showSnackbarMessage(
                    getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_activation)
                    )
                )
            }
            // Other error
            else -> {
                showSnackbarMessage(
                    getString(R.string.status_scan_error,
                        getString(R.string.status_scan_error_unknown)
                    )
                )
            }
        }

        // Cancel progress indicator
        setButtonsForState(deviceState)
    }

    // region Camera
    private fun startTileDecode() {
        // Set up ViewModel for tile data and observe changes
        tileDecodeViewModel.getTileString().observe(this, this::onTileDecode)

        // Navigate to the TileDecodeFragment
        _snackbar?.dismiss()
        Navigation
            .findNavController(requireView())
            .navigate(R.id.action_HomeFragment_to_TileDecodeFragment)
    }

    private fun onTileDecode(decoded: String) {
        // Remove observers for serial number entry and clear entered value
        if (tileDecodeViewModel.getTileString().hasObservers())
            tileDecodeViewModel.getTileString().removeObservers(this)
        tileDecodeViewModel.clear()

        // Check if the decoded string is valid
        when(_device?.isTileStringValid(decoded)) {
            true -> {
                // Prompt the user to place the unit on the tile before running the scan
                AlertDialog.Builder(requireContext())
                    .setMessage(R.string.hint_calibration_place_on_tile)
                    .setPositiveButton(R.string.action_continue) { _, _ ->
                        startCalibrationTileScan(decoded)
                    }
                    .setNegativeButton(R.string.action_cancel) { _, _ -> }
                    .show()
            }
            false -> {
                // Tile does not correspond to this unit, alert the user to try again
                showSnackbarMessage(getString(R.string.error_incorrect_tile_serial), 10000)
            }
            null -> {
                // String does not match the expected format
                showSnackbarMessage(getString(R.string.error_incorrect_tile_format), 10000)
            }
        }
    }

    private fun startCalibrationTileScan(tileString: String) {
        // Callback for field calibration
        val listener = object : OnDeviceResultListener {
            override fun onDeviceResult(
                status: CommandStatus,
                measurements: Map<ScanMode, IMeasurementData>?
            ) {
                // Show status message on result
                showSnackbarMessage(
                    getString(R.string.status_calibration_complete, status.name),
                    5000
                )

                // Update buttons for idle state
                setButtonsForState(deviceState)

                // Haptic feedback
                Utils.vibrateOnScanComplete(requireContext())
            }
        }

        // Haptic feedback
        Utils.vibrateOnScanStart(requireContext())

        // Run field calibration scan
        _device?.let {
            // Update buttons for busy state
            setButtonsForState(DeviceState.BUSY_RUNNING_COMMAND)
            it.runFieldCalibration(listener, tileString)
        }
    }
    // endregion

    // region Permission requests
    /**
     * Callback for Bluetooth permissions request result. Note that fragments must call
     * registerForActivityResult() before they are created (i.e. initialization, onAttach(), or
     * onCreate()). Initializing this here satisfies this requirement.
     */
    private val bluetoothPermissionRequestLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            var allGranted = true
            permissions.forEach { allGranted = allGranted and it.value }
            if (allGranted) {
                Log.d(TAG, "Bluetooth permissions granted")
                runDeviceSearchBluetooth()
            } else {
                Log.e(TAG, "Can't access Bluetooth permissions, scan will be impossible")
                val reattemptId =
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
                        R.string.message_location_denied
                    else
                        R.string.message_bluetooth_denied

                showSnackbarMessage(
                    getString(R.string.message_permission_error,
                        getString(reattemptId)
                    )
                )
            }
        }

    /**
     * Launches a request to the user to grant necessary permissions to use Bluetooth after
     * displaying a primer message dialog.
     */
    private fun requestBluetoothPermission() {
        // Prepare an alert dialog to prime the user for the permission request
        val safeContext = context ?: return
        val permissionPrimerId =
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
                R.string.message_location_permission_primer
            else
                R.string.message_bluetooth_permission_primer

        val permissionPrimerReattemptId =
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S)
                R.string.message_location_permission_primer_reattempt
            else
                R.string.message_bluetooth_permission_primer_reattempt

        val builder = AlertDialog.Builder(safeContext)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // User will be asked to grant permission
            builder.setTitle(R.string.title_permission_primer)
                .setMessage(
                    getString(permissionPrimerId,
                        getString(R.string.message_permission_primer_first_attempt)))
                .setPositiveButton(R.string.action_ok
                ) { _, _ ->
                    // Launch the permission request
                    bluetoothPermissionRequestLauncher.launch(
                        IDeviceScanner.requiredBluetoothPermissions)
                }
        } else {
            // Direct user to app settings to grant permission
            builder.setTitle(R.string.title_permission_primer)
                .setMessage(getString(permissionPrimerId, getString(permissionPrimerReattemptId)))
                .setPositiveButton(R.string.action_ok) { _, _ ->
                    Utils.launchSettingsIntent(activity)
                }
                .setNegativeButton(R.string.action_cancel) { _, _ ->
                    showSnackbarMessage(
                        getString(R.string.message_permission_error,
                            getString(permissionPrimerReattemptId)
                        )
                    )
                }
        }
        builder.show()
    }

    private val cameraPermissionRequestLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            Log.d(TAG, "Camera permission granted")
            startTileDecode()
        } else {
            Log.e(TAG, "Can't access camera, cannot scan QR code for calibration")
            showSnackbarMessage(
                getString(R.string.message_permission_error,
                    getString(R.string.message_camera_denied)
                )
            )
        }
    }

    private fun requestCameraPermission() {
        val safeContext = context ?: return
        val builder = AlertDialog.Builder(safeContext)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // User will be asked to grant permission
            builder.setTitle(R.string.title_permission_primer)
                .setMessage(
                    getString(R.string.message_camera_permission_primer,
                        getString(R.string.message_permission_primer_first_attempt))
                )
                .setPositiveButton(R.string.action_ok
                ) { _, _ ->
                    cameraPermissionRequestLauncher.launch(Manifest.permission.CAMERA)
                }
        } else {
            // Direct user to app settings to grant permission
            builder.setTitle(R.string.title_permission_primer)
                .setMessage(
                    getString(R.string.message_camera_permission_primer,
                        getString(R.string.message_camera_permission_primer_reattempt)))
                .setPositiveButton(R.string.action_ok) { _, _ ->
                    Utils.launchSettingsIntent(activity)
                }
                .setNegativeButton(R.string.action_cancel) { _, _ ->
                    showSnackbarMessage(
                        getString(
                            R.string.message_permission_error,
                            getString(R.string.message_camera_permission_primer_reattempt))
                    )
                }
        }
        builder.show()
    }
    // endregion

    // region Device search
    private fun runDeviceSearchBluetooth() {
        val dialogFragment = DeviceDialogFragment()
        dialogFragment.deviceDialogListener =
            object : DeviceDialogFragment.DeviceDialogListener {
                override fun onDeviceSelected(device: IDeviceCompat) =
                    this@HomeFragment.onDeviceSelected(device)

                override fun onError(errorState: IDeviceScanner.DeviceScannerState) {
                    when (errorState) {
                        // Scanner has not started due to a license / activation error
                        ERROR_LICENSE -> handleActivationError()
                        else -> {
                            showSnackbarMessage(getString(
                                R.string.message_device_scanner_error,
                                errorState.name))
                        }
                    }
                }
        }
        dialogFragment.show(childFragmentManager, dialogFragment.javaClass.simpleName)
    }

    /**
     * Open connection to device
     */
    private fun onDeviceSelected(device: IDeviceCompat) {
        // Show progress indicator and hide buttons
        setButtonsForState(DeviceState.BUSY_CONNECTING)

        // Show snackbar
        val message = getString(R.string.status_connecting, device.id)
        showSnackbarMessage(message, Snackbar.LENGTH_INDEFINITE)

        // Initiate connection
        device.connect(this@HomeFragment)
    }
    // end region

    // region IDeviceCompat.OnDeviceStateChangeListener
    override fun onConnected(sender: IDeviceCompat) {
        Log.d(TAG, "${sender.name} connected")

        // Save reference to this device
        deviceViewModel.setDevice(sender)
        _device = sender

        // Hide progress indicator and show buttons
        setButtonsForState(DeviceState.IDLE)

        // Create options menu
        createOptionsMenu()

        // Show snackbar with status
        val message = getString(R.string.status_connected, sender.name)
        showSnackbarMessage(message)
    }

    override fun onDisconnected(sender: IDeviceCompat, status: DeviceStatus) {
        Log.d(TAG, "${sender.name} disconnected with status ${status.name}")

        setButtonsForState(DeviceState.DISCONNECTED)

        // Show snackbar with status
        val message = getString(R.string.status_disconnected, sender.name)
        showSnackbarMessage(message)

        // Re-create options menu
        createOptionsMenu()

        // Remove reference from view model
        deviceViewModel.clear()

        // Handle status codes here, if desired in your application
        // At minimum, should check for ERROR_UNAUTHORIZED status
        when (status) {
            // Nix Universal SDK is not activated
            DeviceStatus.ERROR_LICENSE -> handleActivationError()

            // Device type is not supported by the active SDK license
            // (ActivationManager.Shared.isDeviceTypeSupported(type: DeviceType) is false)
            DeviceStatus.ERROR_UNSUPPORTED_DEVICE -> handleDeviceNotSupportedError(sender)

            // Device not authorized for this SDK build
            DeviceStatus.ERROR_UNAUTHORIZED -> handleUnauthorizedDevice(sender)

            // Normal disconnect, triggered by device.disconnect()
            DeviceStatus.SUCCESS -> { }

            // Nix device dropped the connection
            DeviceStatus.ERROR_DROPPED_CONNECTION -> { }

            // Connection to Nix device timed out
            DeviceStatus.ERROR_TIMEOUT -> { }

            // Other internal errors
            DeviceStatus.ERROR_MAX_ATTEMPTS,
            DeviceStatus.ERROR_INTERNAL -> { }
        }
    }

    override fun onBatteryStateChanged(sender: IDeviceCompat, newState: Int) {
        super.onBatteryStateChanged(sender, newState)

        // Notify device view model that device battery state has changed
        // Note that in the view model this automatically updates from its saved device reference
        deviceViewModel.updateBatteryState()
    }

    override fun onExtPowerStateChanged(sender: IDeviceCompat, newState: Boolean) {
        super.onExtPowerStateChanged(sender, newState)

        // Notify device view model that device external power state has changed
        // Note that in the view model this automatically updates from its saved device reference
        deviceViewModel.updateExtPowerState()
    }
    // endregion
}