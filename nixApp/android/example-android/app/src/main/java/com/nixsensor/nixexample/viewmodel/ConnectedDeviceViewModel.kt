package com.nixsensor.nixexample.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.nixsensor.universalsdk.IDeviceCompat

class ConnectedDeviceViewModel : ViewModel() {
    private var _liveDevice: MutableLiveData<IDeviceCompat> = MutableLiveData()
    private var _liveBattery: MutableLiveData<Int> = MutableLiveData()
    private var _liveExtPowerState: MutableLiveData<Boolean> = MutableLiveData()

    fun clear() {
        _liveDevice = MutableLiveData()
    }

    fun setDevice(device: IDeviceCompat) {
        _liveDevice.value = device
    }

    fun getDevice(): LiveData<IDeviceCompat> {
        return _liveDevice
    }

    fun updateBatteryState() {
        _liveDevice.value?.batteryLevel?.let { _liveBattery.setValue(it) }
    }

    fun getBatteryState(): LiveData<Int> {
        return _liveBattery
    }

    fun updateExtPowerState() {
        _liveDevice.value?.extPowerState?.let { _liveExtPowerState.setValue(it) }
    }

    fun getExtPowerState(): LiveData<Boolean> {
        return _liveExtPowerState
    }

}