/*
 * Copyright 2020 Google LLC. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.nixsensor.nixexample.util.mlkit;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.android.gms.tasks.Task;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;

import java.util.List;

/** Barcode Detector Demo. */
public class BarcodeScannerProcessor extends VisionProcessorBase<List<Barcode>> {

    private static final String TAG = "BarcodeProcessor";

    private final BarcodeScanner barcodeScanner;
    private BarcodeResultListener barcodeResultListener;

    public BarcodeScannerProcessor(Context context) {
        super(context);
        // Note that if you know which format of barcode your app is dealing with, detection will be
        // faster to specify the supported barcode formats one by one, e.g.
        // new BarcodeScannerOptions.Builder()
        //     .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        //     .build();
        barcodeScanner = BarcodeScanning.getClient();
    }

    public BarcodeScannerProcessor(Context context, BarcodeScannerOptions options) {
        super(context);
        // Note that if you know which format of barcode your app is dealing with, detection will be
        // faster to specify the supported barcode formats one by one, e.g.
        // new BarcodeScannerOptions.Builder()
        //     .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
        //     .build();
        barcodeScanner = BarcodeScanning.getClient(options);
    }

    public BarcodeResultListener getBarcodeResultListener() {
        return barcodeResultListener;
    }

    public void setBarcodeResultListener(BarcodeResultListener barcodeResultListener) {
        this.barcodeResultListener = barcodeResultListener;
    }

    @Override
    public void stop() {
        super.stop();
        barcodeScanner.close();
    }

    @Override
    protected Task<List<Barcode>> detectInImage(InputImage image) {
        return barcodeScanner.process(image);
    }

    @Override
    protected void onSuccess(
            @NonNull List<Barcode> barcodes, @NonNull GraphicOverlay graphicOverlay) {
        if (barcodes.isEmpty()) {
            Log.v(MANUAL_TESTING_LOG, "No barcode has been detected");
        }

        for (int i = 0; i < barcodes.size(); ++i) {
            Barcode barcode = barcodes.get(i);
            graphicOverlay.add(new BarcodeGraphic(graphicOverlay, barcode));
        }

        if (barcodeResultListener!=null)
            barcodeResultListener.onSuccess(barcodes,graphicOverlay);
    }

    @Override
    protected void onFailure(@NonNull Exception e) {
        Log.e(TAG, "Barcode detection failed " + e);
        if(barcodeResultListener != null)
            barcodeResultListener.onFailure(e);
    }

    public interface BarcodeResultListener
    {
        void onSuccess(
                @NonNull List<Barcode> barcodes,
                @NonNull GraphicOverlay graphicOverlay);

        void onFailure(@NonNull Exception e);
    }
}