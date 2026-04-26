package com.nixsensor.nixexample.fragment

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.DrawableCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import com.nixsensor.nixexample.R
import com.nixsensor.nixexample.databinding.FragmentColorDetailBinding
import com.nixsensor.nixexample.util.Utils
import com.nixsensor.nixexample.viewmodel.MeasurementViewModel
import com.nixsensor.universalsdk.ReferenceWhite
import com.nixsensor.universalsdk.IColorData.ColorType.CIELAB
import com.nixsensor.universalsdk.IMeasurementData
import java.util.*

/**
 * Fragment which presents the color and LAB value.
 */
class ColorDetailFragment : Fragment() {
    companion object {
        private const val TAG = "ColorDetailFragment"
    }

    private var _binding: FragmentColorDetailBinding? = null
    private val binding get() = _binding!!
    private val measurementViewModel: MeasurementViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Inflate the layout for this fragment
        _binding = FragmentColorDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Initialize the display
        initColorDataDisplay()

        // Set view model observers
        // Observer for new MeasurementData
        measurementViewModel.getMeasurement().observe(viewLifecycleOwner) { measurement ->
            val reference =
                measurementViewModel.getReference().value ?: MeasurementViewModel.DEFAULT_REFERENCE
            updateColorDataDisplay(measurement, reference)
        }

        // Observer for new ReferenceWhite
        measurementViewModel.getReference().observe(viewLifecycleOwner) { reference ->
            measurementViewModel.getMeasurement().value?.let { measurement ->
                updateColorDataDisplay(measurement, reference)
            }
        }

        // Set listener for reference white button
        binding.buttonMore.setOnClickListener { onReferenceWhiteButtonClicked() }
    }

    private fun initColorDataDisplay() {
        val safeContext = context ?: return

        // Set swatch background to bars
        ContextCompat.getDrawable(
            safeContext,
            R.drawable.shape_empty_swatch_mirror
        )?.let { swatchShape -> binding.swatch.background = swatchShape }

        // Hide lab value labels
        binding.labValueView.visibility = View.INVISIBLE
        binding.labReferenceView.visibility = View.INVISIBLE
    }

    private fun updateColorDataDisplay(
        measurement: IMeasurementData,
        reference: ReferenceWhite) {
        val safeContext = context ?: return
        val colorData = measurement.toColorData(reference) ?: return

        // Draw color on screen based on its sRGB value
        val swatchColor = colorData.colorInt
        val textColor = Utils.colorForOverlayText(colorData.colorInt)

        // Set swatch color on screen
        ContextCompat.getDrawable(
            safeContext,
            R.drawable.shape_swatch_scan
        )?.let { shape -> binding.swatch.background = DrawableCompat.wrap(shape) }
        binding.swatch.background?.let { bg -> DrawableCompat.setTint(bg, swatchColor) }

        // Display LAB value
        val lab = colorData.convertTo(CIELAB)
        binding.labValueView.text = String.format(
            Locale.CANADA,
            "%.2f, %.2f, %.2f",
            lab.value[0], lab.value[1], lab.value[2]
        )
        binding.labReferenceView.text = safeContext.getString(
            R.string.label_cielab,
            colorData.reference.fullName
        )

        binding.labValueView.setTextColor(textColor)
        binding.labReferenceView.setTextColor(textColor)

        binding.labValueView.visibility = View.VISIBLE
        binding.labReferenceView.visibility = View.VISIBLE

        // More button
        binding.buttonMore.setColorFilter(textColor)
        binding.buttonMore.visibility = if (measurement.supportedReferences.size > 1)
            View.VISIBLE
        else
            View.GONE
    }

    private fun onReferenceWhiteButtonClicked() {
        val fragment = BottomSheetListFragment.newInstance(
            BottomSheetListFragment.LIST_TYPE_REFERENCE_WHITE_OPTIONS)
        fragment.show(childFragmentManager, fragment.tag)
    }
}