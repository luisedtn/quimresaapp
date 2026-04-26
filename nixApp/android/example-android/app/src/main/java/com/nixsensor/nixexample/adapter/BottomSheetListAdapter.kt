package com.nixsensor.nixexample.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.appcompat.widget.AppCompatRadioButton
import androidx.appcompat.widget.SwitchCompat
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.fragment.BottomSheetListFragment
import com.nixsensor.nixexample.fragment.BottomSheetListFragment.SimpleOptionsItem

class BottomSheetListAdapter(
    context: Context,
    private val layoutResource: Int,
    objects: ArrayList<SimpleOptionsItem>
) : ArrayAdapter<SimpleOptionsItem>(context, layoutResource, objects) {
    companion object {
        class Holder {
            var titleView: TextView? = null
            var subtitleView: TextView? = null
            var endIconView: ImageView? = null
            var radioButton: AppCompatRadioButton? = null
            var switch: SwitchCompat? = null
            var progressBar: ProgressBar? = null
            var switchContainer: RelativeLayout? = null
        }
    }

    override fun getView(position: Int, row: View?, parent: ViewGroup): View {
        val holder: Holder
        val returnView: View

        if (row == null) {
            val inflater = LayoutInflater.from(parent.context)
            returnView = inflater.inflate(layoutResource, parent, false)

            holder = Holder()
            holder.titleView = returnView.findViewById(R.id.first_line_text)
            holder.subtitleView = returnView.findViewById(R.id.second_line_text)
            holder.endIconView = returnView.findViewById(R.id.end_image_view)
            holder.radioButton = returnView.findViewById(R.id.radio_button)
            holder.switch = returnView.findViewById(R.id.end_switch)
            holder.progressBar = returnView.findViewById(R.id.progress_bar)
            holder.switchContainer = returnView.findViewById(R.id.end_switch_container)
            returnView.tag = holder
        } else {
            returnView = row
            holder = returnView.tag as Holder
        }

        getItem(position)?.let {
            if (it.title != null)
                holder.titleView?.text = it.title
            else
                holder.titleView?.visibility = View.GONE

            if (it.subtitle != null)
                holder.subtitleView?.text = it.subtitle
            else
                holder.subtitleView?.visibility = View.GONE

            // Setting up the radio button and end icon depends on the list type
            when (it.type) {
                BottomSheetListFragment.LIST_TYPE_REFERENCE_WHITE_OPTIONS -> {
                    holder.switchContainer?.visibility = View.GONE
                    holder.endIconView?.visibility = View.GONE
                    holder.radioButton?.visibility = View.VISIBLE
                    holder.radioButton?.isEnabled = it.enabled
                    holder.radioButton?.isChecked = it.checked == true
                }
                BottomSheetListFragment.LIST_TYPE_SCAN_INFO -> {
                    holder.switchContainer?.visibility = View.GONE
                    holder.endIconView?.visibility = View.GONE
                    holder.radioButton?.visibility = View.GONE
                }
                BottomSheetListFragment.LIST_TYPE_DEVICE_OPTIONS -> {
                    holder.switchContainer?.visibility = View.VISIBLE
                    holder.radioButton?.visibility = View.GONE
                    holder.endIconView?.visibility = View.GONE

                    it.checked?.let { isChecked ->
                        holder.switch?.isChecked = isChecked
                        holder.switch?.visibility = View.VISIBLE
                        holder.progressBar?.visibility = View.INVISIBLE
                    } ?: run {
                        holder.switch?.visibility = View.INVISIBLE
                        holder.progressBar?.visibility = View.VISIBLE
                    }
                }
            }
        }
        return returnView
    }
}