package com.nixsensor.nixexample.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class TileDecodeViewModel : ViewModel() {
    private var _liveTileString: MutableLiveData<String> = MutableLiveData()

    fun clear() {
        _liveTileString = MutableLiveData()
    }

    fun setTileString(string: String) {
        _liveTileString.value = string
    }

    fun getTileString(): LiveData<String> {
        return _liveTileString
    }
}