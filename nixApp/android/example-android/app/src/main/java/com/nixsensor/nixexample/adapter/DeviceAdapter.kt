package com.nixsensor.nixexample.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ImageView
import android.widget.TextView
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.fragment.DeviceDialogFragment
import com.nixsensor.universalsdk.IDeviceCompat
import com.nixsensor.universalsdk.IDeviceCompat.InterfaceType.*

/**
 * Adapter used for the list shown in the [DeviceDialogFragment], with each item representing a
 * discovered Nix device
 */
class DeviceAdapter(var devices: List<IDeviceCompat>) : BaseAdapter() {
    override fun getCount(): Int = devices.count()
    override fun getItem(position: Int): IDeviceCompat = devices[position]
    override fun getItemId(position: Int): Long = 0
    override fun getView(position: Int, view: View?, parent: ViewGroup?): View {
        val holder: ViewHolder
        val returnView: View
        if (view == null) {
            val inflater = LayoutInflater.from(parent?.context)
            returnView = inflater.inflate(R.layout.cell_with_subtitle_and_end_icon, parent, false)

            holder = ViewHolder()
            holder.tvDeviceName = returnView.findViewById(R.id.first_line_text)
            holder.tvDeviceAddress = returnView.findViewById(R.id.second_line_text)
            holder.ivEndIcon = returnView.findViewById(R.id.end_image_view)

            returnView.tag = holder
        } else {
            returnView = view
            holder = view.tag as ViewHolder
        }

        // Set device name and address to cell
        holder.tvDeviceName?.text = devices[position].name
        holder.tvDeviceAddress?.text = devices[position].id

        when (devices[position].interfaceType) {
            BLE -> {
                // Set icon according to RSSI value
                holder.ivEndIcon?.setImageResource(getRssiDrawableId(devices[position].rssi))
                holder.ivEndIcon?.visibility = View.VISIBLE
            }
            USB_CDC -> {
                // Device is connected via cable, set icon to match
                holder.ivEndIcon?.setImageResource(R.drawable.ic_cable)
                holder.ivEndIcon?.visibility = View.VISIBLE
            }
            else -> {
                // Hide the icon
                holder.ivEndIcon?.visibility = View.GONE
            }
        }

        return returnView
    }

    companion object {
        private val TAG: String = DeviceAdapter::class.java.simpleName

        class ViewHolder {
            var tvDeviceName: TextView? = null
            var tvDeviceAddress: TextView? = null
            var ivEndIcon: ImageView? = null
        }

        private fun getRssiDrawableId(rssi: Int): Int =
            if (rssi >= -45)
                R.drawable.ic_signal_4_bar
            else if (rssi >= -60)
                R.drawable.ic_signal_3_bar
            else if (rssi >= -75)
                R.drawable.ic_signal_2_bar
            else if (rssi >= -90)
                R.drawable.ic_signal_1_bar
            else
                R.drawable.ic_signal_0_bar
    }
}