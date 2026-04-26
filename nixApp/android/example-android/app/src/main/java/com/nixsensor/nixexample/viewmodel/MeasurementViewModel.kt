package com.nixsensor.nixexample.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.nixsensor.universalsdk.ReferenceWhite
import com.nixsensor.universalsdk.IMeasurementData

class MeasurementViewModel : ViewModel() {
    private var _liveMeasurement: MutableLiveData<IMeasurementData> = MutableLiveData()
    private var _liveReference: MutableLiveData<ReferenceWhite> = MutableLiveData()

    companion object {
        /**
         * Default reference white value, corresponding to [ReferenceWhite.D50_2] which is supported
         * by all Nix devices.
         */
        val DEFAULT_REFERENCE = ReferenceWhite.D50_2
    }

    fun clear() {
        _liveMeasurement = MutableLiveData()
        _liveReference.value = DEFAULT_REFERENCE
    }

    fun setMeasurement(data: IMeasurementData) {
        _liveMeasurement.value = data

        // Select D50/2 as default reference if one is not set
        val currentReference = _liveReference.value ?: DEFAULT_REFERENCE

        // Verify that the currently selected reference is supported by the new measurement data
        // If not, fall back to the default
        if (!data.supportedReferences.contains(currentReference))
            _liveReference.value = DEFAULT_REFERENCE
    }

    fun getMeasurement(): LiveData<IMeasurementData> {
        return _liveMeasurement
    }

    fun setReference(reference: ReferenceWhite) {
        _liveReference.value = reference
    }

    fun getReference(): LiveData<ReferenceWhite> {
        return _liveReference
    }
}