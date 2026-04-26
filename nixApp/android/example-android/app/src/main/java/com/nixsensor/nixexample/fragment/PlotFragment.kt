package com.nixsensor.nixexample.fragment

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.github.mikephil.charting.charts.ScatterChart
import com.github.mikephil.charting.components.MarkerView
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.*
import com.github.mikephil.charting.highlight.Highlight
import com.github.mikephil.charting.listener.OnChartValueSelectedListener
import com.google.android.material.color.MaterialColors
import com.nixsensor.nixexample.R

import com.nixsensor.nixexample.databinding.FragmentPlotBinding
import com.nixsensor.nixexample.viewmodel.MeasurementViewModel
import com.nixsensor.universalsdk.LicenseManager
import com.nixsensor.universalsdk.LicenseFeature.SPECTRAL_DATA
import com.nixsensor.universalsdk.IMeasurementData
import com.nixsensor.universalsdk.ISpectralData
import java.util.*
import kotlin.collections.ArrayList

/**
 * Fragment which presents the spectral plot for the app
 */
class PlotFragment : Fragment() {
    companion object {
        private const val TAG = "PlotFragment"
    }

    private var _binding: FragmentPlotBinding? = null
    private val binding get() = _binding!!
    private var _marker: MarkerView? = null

    /**
     * View model containing measurement LiveData
     */
    private val measurementViewModel: MeasurementViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Inflate the layout for this fragment
        _binding = FragmentPlotBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Style the plot
        initPlot()

        // Set up buttons
        binding.plotInfoButton.setOnClickListener { onPlotInfoClicked() }

        // Set view model observer
        measurementViewModel.getMeasurement().observe(viewLifecycleOwner, this::updateSpectralDataPlot)
    }

    private fun initPlot() {
        val safeContext = context ?: return
        val backgroundColor = MaterialColors.getColor(
            safeContext,
            com.google.android.material.R.attr.colorBackgroundFloating,
            Color.BLACK
        )
        val textColor = MaterialColors.getColor(
            safeContext,
            com.google.android.material.R.attr.colorOnBackground,
            Color.BLACK
        )

        // Background
        binding.plot.setBackgroundColor(Color.TRANSPARENT)
        binding.plotContainer.setCardBackgroundColor(backgroundColor)

        // XAxis
        binding.plot.xAxis?.let { axis ->
            axis.textColor = textColor
            axis.position = XAxis.XAxisPosition.BOTTOM
        }
        binding.xAxisLabel.setTextColor(textColor)

        // YAxis
        binding.plot.axisRight?.isEnabled = false
        binding.plot.axisLeft?.textColor = textColor
        binding.yAxisLabel.setTextColor(textColor)

        // Legend
        binding.plot.legend?.isEnabled = false

        // Description
        binding.plot.description?.isEnabled = false

        // Set listener for value selection
        binding.plot.setOnChartValueSelectedListener(_chartValueSelectedListener)
        _marker = MarkerView(safeContext, R.layout.spectral_plot_marker)
        _marker?.chartView = binding.plot
        binding.plot.marker = _marker

        // Set info button invisible
        binding.plotInfoButton.visibility = View.INVISIBLE
    }

    private val _chartValueSelectedListener = object : OnChartValueSelectedListener {
        override fun onValueSelected(e: Entry?, h: Highlight?) {
            // Set selected value on screen

            // Find text labels in the plot marker
            val lambdaLabel: TextView? = _marker?.findViewById(R.id.lambda_value_view)
            val reflectanceLabel: TextView? = _marker?.findViewById(R.id.reflectance_value_view)

            // Update labels
            e?.let { entry ->
                lambdaLabel?.text = String.format(Locale.CANADA, "%.0f nm", entry.x)
                reflectanceLabel?.text = String.format(Locale.CANADA, "%.6f", entry.y)
            }

            // Show labels
            lambdaLabel?.visibility = View.VISIBLE
            reflectanceLabel?.visibility = View.VISIBLE
        }

        override fun onNothingSelected() {
            // Clear selected value on screen

            // Find text labels in the plot marker
            val lambdaLabel: TextView? = _marker?.findViewById(R.id.lambda_value_view)
            val reflectanceLabel: TextView? = _marker?.findViewById(R.id.reflectance_value_view)

            // Hide labels
            lambdaLabel?.visibility = View.INVISIBLE
            reflectanceLabel?.visibility = View.INVISIBLE
        }
    }

    private fun updateSpectralDataPlot(measurement: IMeasurementData) {
        // Reflectance points are shown as a scatter plot
        // Line is drawn in between points using spline interpolation

        // Check if spectral data is available
        if (!measurement.providesSpectral) {
            // No spectral data is available, clear the plot and hide the plot view
            binding.plot.clear()
            binding.plot.visibility = View.INVISIBLE

            // Show warning label
            // Check if spectral data is unavailable because of licensing or device limitations

            // Check if spectral data license is active
            val spectralLicensed = LicenseManager.isFeatureEnabled(SPECTRAL_DATA)

            // Check if measurement device supports spectral data
            val spectralDevice = measurement.deviceType.isFeatureSupported(SPECTRAL_DATA)

            binding.emptyPlotLabel.text = if (!spectralDevice) {
                // Device does not support spectral data
                getString(
                    R.string.message_spectral_unavailable_device,
                    measurement.deviceType.fullName)
            } else if (!spectralLicensed) {
                // Device supports spectral data but it is not licensed
                getString(R.string.message_spectral_unavailable_licensing)
            } else {
                // Spectral data is not available for unknown reasons
                getString(R.string.message_spectral_unavailable_generic)
            }
            binding.emptyPlotLabel.visibility = View.VISIBLE
        } else {
            // Spectral data is available, show the plot
            binding.plot.visibility = View.VISIBLE

            // Hide the warning label
            binding.emptyPlotLabel.visibility = View.GONE
        }

        // Show the info button
        binding.plotInfoButton.visibility = View.VISIBLE

        val data: ISpectralData = measurement.spectralData ?: return
        val safeContext = context ?: return
        val dataSetColor = MaterialColors.getColor(
            safeContext,
            com.google.android.material.R.attr.colorPrimary, Color.BLACK
        )

        // SCATTER PLOT ENTRIES
        // Wrap data into Entry objects
        val scatterEntries: ArrayList<Entry> = ArrayList()
        for (i in data.value.indices)
            scatterEntries.add(Entry(data.lambda[i].toFloat(), data.value[i]))

        // Create ScatterDataSet from entries
        val scatterDataSet = ScatterDataSet(scatterEntries, "Reflectance")
        scatterDataSet.color = dataSetColor
        scatterDataSet.setScatterShape(ScatterChart.ScatterShape.CIRCLE)
        scatterDataSet.scatterShapeHoleColor = Color.WHITE
        scatterDataSet.scatterShapeHoleRadius = scatterDataSet.scatterShapeSize / 10

        val scatterData = ScatterData(scatterDataSet)
        scatterData.setDrawValues(false)

        // INTERPOLATED LINE AT 1 nm SPACING
        val splineEntries: ArrayList<Entry> = ArrayList()
        for (i in 400 until 700)
            splineEntries.add(Entry(i.toFloat(), data.interpolate(i.toFloat())))

        // Create LineDataSet from interpolated entries
        val lineDataSet = LineDataSet(splineEntries, "Interpolated")
        lineDataSet.color = dataSetColor
        lineDataSet.setDrawCircles(false)
        lineDataSet.mode = LineDataSet.Mode.CUBIC_BEZIER

        val lineData = LineData(lineDataSet)
        lineData.setDrawValues(false)
        lineData.isHighlightEnabled = false

        // Combine the two data sets
        val combinedData = CombinedData()
        combinedData.setData(scatterData)
        combinedData.setData(lineData)
        binding.plot.data = combinedData

        // Reset plot zoom
        // Note: MPAndroidChart bug? plot.resetZoom() does not appear to work
        // plot.fitScreen() seems to work
        binding.plot.fitScreen()

        // Reset x-axis limits
        binding.plot.xAxis?.let { axis ->
            axis.resetAxisMinimum()
            axis.resetAxisMaximum()
        }

        // Reset y-axis limits
        // Typically set the default max to 2% greater than 1
        // For neon colours, allow display of higher top end
        binding.plot.axisLeft?.let { axis ->
            axis.axisMaximum = (combinedData.yMax * 1.02f).coerceAtLeast(1.02f)
            axis.axisMinimum = 0f
        }

        // Clear any highlighted points
        binding.plot.highlightValue(null, true)

        // Update plot
        binding.plot.invalidate()
    }

    private fun onPlotInfoClicked() {
        // Show the scan info
        val fragment =
            BottomSheetListFragment.newInstance(BottomSheetListFragment.LIST_TYPE_SCAN_INFO)
        fragment.show(childFragmentManager, fragment.tag)
    }
}