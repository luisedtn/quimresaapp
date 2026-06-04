import React, { useRef, useState } from 'react';
import { X, Download, Printer, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { format, addYears } from 'date-fns';
import { motion } from 'motion/react';
import { loadSettings } from './DeviceSettings';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface GenerarPDFProps {
    onClose: () => void;
    qcContextData: any;
}

export default function GenerarPDF({ onClose, qcContextData }: GenerarPDFProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedOk, setSavedOk] = useState<boolean | null>(null);

    // Parse required data
    const formulaName = qcContextData?.formulaName || 'Fórmula Encontrada';
    const codigo = qcContextData?.sample?.name || 'GEN-01';
    const client = 'MADEVAL';
    const quantity = `${qcContextData?.prepareAmount || 1} LT`;
    const density = '1.42';
    const viscosity = "0' 59.9\"";

    const l1 = (qcContextData?.standard?.l || 0).toFixed(2);
    const a1 = (qcContextData?.standard?.a || 0).toFixed(2);
    const b1 = (qcContextData?.standard?.b || 0).toFixed(2);

    const l2 = (qcContextData?.sample?.l || 0).toFixed(2);
    const a2 = (qcContextData?.sample?.a || 0).toFixed(2);
    const b2 = (qcContextData?.sample?.b || 0).toFixed(2);

    const dL = qcContextData?.dL || '0.00';
    const dA = qcContextData?.dA || '0.00';
    const dB = qcContextData?.dB || '0.00';
    const dE = parseFloat(qcContextData?.de || '0.00');

    const patronHex = qcContextData?.standard?.hex || '#e2e8f0';
    const sampleHex = qcContextData?.sample?.hex || '#e2e8f0';

    const dateNow = new Date();
    const dateElaboracion = format(dateNow, 'dd/MM/yy, hh:mm:ss a');
    const datePreparacion = format(dateNow, 'dd/MM/yy, hh:mm:ss a');
    const dateCaducidad = format(addYears(dateNow, 3), 'dd/MM/yy');

    // CIELAB chart
    const dA_val = parseFloat(dA);
    const dB_val = parseFloat(dB);
    const distAb = Math.sqrt(dA_val * dA_val + dB_val * dB_val);
    const chartMax = Math.max(2, Math.ceil(distAb));
    let plotX = 50 + (dA_val / chartMax) * 50;
    let plotY = 50 - (dB_val / chartMax) * 50;
    plotX = Math.max(0, Math.min(100, plotX));
    plotY = Math.max(0, Math.min(100, plotY));

    const maxL = 1.0;
    let plotL = 50 + (parseFloat(dL) / maxL) * 50;
    plotL = Math.max(0, Math.min(100, plotL));

    const ringStep = chartMax / 4;
    const rings = Array.from({ length: 4 }, (_, i) => (i + 1) * ringStep);

    const passStatus = dE <= 1.0 ? 'EXCELENTE' : dE <= 3.0 ? 'BUENO' : 'NO PASA';
    const passColor = dE <= 1.0 ? '#16a34a' : dE <= 3.0 ? '#ca8a04' : '#dc2626';
    const passTextColor = '#ffffff';

    const StatusIcon = dE <= 1.0 ? CheckCircle : dE <= 3.0 ? AlertCircle : XCircle;

    const handleGeneratePDF = async () => {
        if (!printRef.current) return;
        setIsGenerating(true);
        setSavedOk(null);
        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 1.5,
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const pageWidth = 210;
            const imgHeightMm = (canvas.height * pageWidth) / canvas.width;

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: [pageWidth, imgHeightMm],
            });

            pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeightMm);

            const pdfDataUri = pdf.output('datauristring');
            const pdfBase64 = pdfDataUri.split('base64,')[1];
            const loteFinal = '030226MXPUHAAA';

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    clientCode: client,
                    lote: loteFinal,
                    pdfBase64: pdfBase64
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al guardar PDF');
            }

            // Save PDF URL and quality control details to database
            try {
                const deviceSettings = loadSettings();
                const relativePdfUrl = `/controlcalidad/${client}/${loteFinal}.pdf`;
                const userDataStr = localStorage.getItem('userData');
                const userDataObj = userDataStr ? JSON.parse(userDataStr) : null;
                const headers: any = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };
                if (userDataObj?.idcliente) {
                    headers['x-client-id'] = userDataObj.idcliente.toString();
                }

                const dbPayload = {
                    nombre: qcContextData?.sessionName || formulaName,
                    descripcion: qcContextData?.sessionDesc || '',
                    patron_nombre: qcContextData?.standard?.name || 'Patrón',
                    patron_l: qcContextData?.standard?.l,
                    patron_a: qcContextData?.standard?.a,
                    patron_b: qcContextData?.standard?.b,
                    patron_hex: patronHex,
                    muestra_nombre: qcContextData?.sample?.name || 'Muestra',
                    muestra_l: qcContextData?.sample?.l,
                    muestra_a: qcContextData?.sample?.a,
                    muestra_b: qcContextData?.sample?.b,
                    muestra_hex: sampleHex,
                    delta_e: dE,
                    delta_l: parseFloat(dL),
                    delta_a: parseFloat(dA),
                    delta_b: parseFloat(dB),
                    blanco_referencia: deviceSettings.referenceWhite || null,
                    modo_medicion: deviceSettings.measurementMode || null,
                    densidad: deviceSettings.densityStatus || null,
                    pdf_url: relativePdfUrl
                };

                await fetch(`${API_BASE_URL}/api/qualitycontrol`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(dbPayload)
                });
            } catch (dbErr) {
                console.error('Error al registrar PDF en base de datos:', dbErr);
            }

            setSavedOk(true);
            setTimeout(() => onClose(), 1500);
        } catch (e) {
            console.error('Error generating PDF:', e);
            setSavedOk(false);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-50 dark:bg-[#0A0F14] overflow-hidden">

            {/* ── Top Header (Dashboard style) ── */}
            <header className="flex-shrink-0 flex w-full items-center justify-between bg-[#CC5200] shadow-lg px-4 py-4 z-[250]">
                {/* Left: icon + title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/15 rounded-lg">
                        <Printer className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold uppercase tracking-tight text-white leading-none">
                            Previsualización de Informe
                        </h1>
                        <p className="text-[10px] text-white/70 mt-0.5 uppercase tracking-widest">
                            Control de Calidad · PDF
                        </p>
                    </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2">
                    {/* Save feedback indicator */}
                    {savedOk === true && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 uppercase tracking-widest">
                            <CheckCircle className="w-4 h-4 text-green-300" /> Guardado
                        </span>
                    )}
                    {savedOk === false && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 uppercase tracking-widest">
                            <XCircle className="w-4 h-4 text-red-300" /> Error
                        </span>
                    )}

                    {/* Save button */}
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={handleGeneratePDF}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        {isGenerating ? 'Guardando...' : 'Guardar PDF'}
                    </motion.button>

                    {/* Close button — far right */}
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-lg transition-all active:scale-90"
                        title="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* ── Scrollable canvas area ── */}
            <div className="flex-1 overflow-y-auto bg-slate-200 dark:bg-slate-900 py-6 flex justify-center">

                {/* A4 Paper */}
                <div
                    className="bg-white shadow-2xl border border-slate-300 dark:border-slate-700"
                    style={{ width: '210mm', minHeight: '279.4mm', padding: '5mm' }}
                >
                    <div ref={printRef} className="w-full h-full bg-white text-black font-sans leading-tight">

                        {/* ── PDF Header ── */}
                        <div className="flex justify-between items-center mb-5 pb-3 border-b-2 border-[#CC5200]">
                            <div className="flex items-center gap-1 font-black text-3xl tracking-tighter">
                                <span className="text-[#CC5200] font-sans">Q</span>uimresa
                            </div>
                            <div className="text-right text-[9px] text-gray-600">
                                <p className="font-bold">QUIMRESA CIA LTDA.</p>
                                <p>GABRIEL GARCIA MORENO Y DOLORES CACUANGO</p>
                                <p>Tels: +(593) 999834752</p>
                            </div>
                        </div>

                        {/* ── Info Grid ── */}
                        <div className="grid grid-cols-4 gap-y-3 gap-x-2 text-[10px] mb-5">
                            {[
                                { label: 'Código', value: codigo, span: 1 },
                                { label: 'Fecha de elaboración', value: dateElaboracion, span: 1 },
                                { label: 'Fecha de preparación', value: datePreparacion, span: 1 },
                                { label: 'Fecha de caducidad', value: dateCaducidad, span: 1 },
                                { label: 'Lote', value: '030226MXPUHAAA', span: 1, mono: true },
                                { label: 'Cliente', value: client, span: 2, upper: true },
                                { label: 'Cantidad', value: quantity, span: 1 },
                                { label: 'Densidad', value: density, span: 1 },
                                { label: 'Nombre de fórmula', value: formulaName, span: 3, upper: true },
                                { label: 'Viscosidad', value: viscosity, span: 1 },
                            ].map((field, i) => (
                                <div key={i} className={`col-span-${field.span} border-b border-gray-300 pb-1`}>
                                    <p className="text-gray-500 text-[8px] uppercase tracking-wide mb-0.5">{field.label}</p>
                                    <p className={`font-bold text-[10px] ${field.mono ? 'font-mono' : ''} ${field.upper ? 'uppercase' : ''}`}>
                                        {field.value}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* ── Title strip ── */}
                        <div className="bg-[#CC5200] text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 mb-0 flex items-center justify-between">
                            <span>Control de Calidad — Colorimetría CIELAB</span>
                            <span className="font-mono text-[8px]">ΔE(CIE2000)</span>
                        </div>

                        {/* ── Graphics Table ── */}
                        <div className="border border-black flex flex-col mb-4">
                            {/* Graphics Row */}
                            <div className="flex h-56 border-b border-black">

                                {/* 1. Rotated label */}
                                <div className="w-[30px] border-r border-black flex items-center justify-center bg-gray-100 relative overflow-hidden">
                                    <span className="-rotate-90 whitespace-nowrap font-black text-[10px] tracking-widest min-w-[180px] text-center inline-block text-[#CC5200]">
                                        CONTROL CALIDAD
                                    </span>
                                </div>

                                {/* 2. LAB Chart */}
                                <div className="flex-1 border-r border-black relative bg-white">
                                    <div className="absolute inset-0 flex items-center justify-center p-2">
                                        <div className="relative w-full max-w-[190px] aspect-square">
                                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black -translate-x-1/2" />
                                            <div className="absolute left-0 right-0 top-1/2 h-px bg-black -translate-y-1/2" />
                                            <span className="absolute top-0 left-1/2 ml-1 text-[8px] font-bold">+b*</span>
                                            <span className="absolute bottom-0 left-1/2 ml-1 text-[8px] font-bold">-b*</span>
                                            <span className="absolute right-0 top-1/2 mt-1 mr-1 text-[8px] font-bold">+a*</span>
                                            <span className="absolute left-0 top-1/2 mt-1 ml-1 text-[8px] font-bold">-a*</span>
                                            {rings.map((val) => (
                                                <div key={val} className="absolute inset-0 pointer-events-none">
                                                    <div
                                                        className="absolute top-1/2 left-1/2 rounded-full border border-black/60"
                                                        style={{
                                                            width: `${(val / chartMax) * 100}%`,
                                                            height: `${(val / chartMax) * 100}%`,
                                                            transform: 'translate(-50%, -50%)'
                                                        }}
                                                    />
                                                    <span className="absolute text-[5px] text-gray-500" style={{
                                                        top: `${50 - ((val / chartMax) * 50)}%`,
                                                        left: '92%',
                                                        transform: 'translate(4px, -50%)'
                                                    }}>
                                                        {val.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                            {/* Standard dot */}
                                            <div className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full bg-green-600 border-2 border-black z-10 -translate-x-1/2 -translate-y-1/2" />
                                            {/* Sample dot */}
                                            <div
                                                className="absolute w-2.5 h-2.5 bg-[#CC5200] rounded-full border-2 border-black z-20"
                                                style={{ left: `${plotX}%`, top: `${plotY}%`, transform: 'translate(-50%, -50%)' }}
                                            />
                                            {/* Legend */}
                                            <div className="absolute bottom-0 right-0 flex flex-col gap-0.5 p-1">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-green-600 border border-black" />
                                                    <span className="text-[5px] font-bold">Patrón</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-[#CC5200] border border-black" />
                                                    <span className="text-[5px] font-bold">Muestra</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. L Bar */}
                                <div className="w-[75px] border-r border-black relative flex flex-col justify-center items-center overflow-visible">
                                    <div className="h-[80%] w-[2px] bg-gradient-to-b from-white via-gray-500 to-black border border-black relative">
                                        {[-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1].reverse().map((level, idx) => (
                                            <div key={idx} className="absolute w-[20px] h-[1px] bg-black" style={{ top: `${idx * 10}%`, left: '-10px' }}>
                                                <span className="absolute text-[5px] left-[22px] transform -translate-y-[2px] text-gray-700">{level.toFixed(1)}</span>
                                            </div>
                                        ))}
                                        {Math.abs(parseFloat(dL)) <= 1.0 && (
                                            <div
                                                className="absolute w-5 h-1 border-[1.5px] border-black bg-[#CC5200] z-30"
                                                style={{ top: `${100 - plotL}%`, left: '-10px', transform: 'translateY(-50%)' }}
                                            />
                                        )}
                                    </div>
                                    <span className="text-[7px] font-bold text-gray-600 mt-1">ΔL*</span>
                                </div>

                                {/* 4. Color comparison */}
                                <div className="flex-1 relative overflow-hidden">
                                    <div className="w-full h-full flex">
                                        <div className="w-1/2 h-full flex flex-col items-center justify-end pb-2" style={{ backgroundColor: patronHex }}>
                                            <span className="text-[6px] font-black text-white drop-shadow-md uppercase tracking-wider">Patrón</span>
                                        </div>
                                        <div className="w-1/2 h-full flex flex-col items-center justify-end pb-2" style={{ backgroundColor: sampleHex }}>
                                            <span className="text-[6px] font-black text-white drop-shadow-md uppercase tracking-wider">Muestra</span>
                                        </div>
                                    </div>
                                    {/* Circle comparison */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] aspect-square rounded-full overflow-hidden flex border-2 border-black/20 shadow-md">
                                        <div className="w-1/2 h-full" style={{ backgroundColor: patronHex }} />
                                        <div className="w-1/2 h-full" style={{ backgroundColor: sampleHex }} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Data Rows ── */}
                            <div className="flex border-b border-black bg-gray-50 min-h-[80px]">
                                {/* Row labels */}
                                <div className="w-[30px] border-r border-black flex flex-col text-[5px] font-bold leading-tight">
                                    <div className="h-[21px] border-b border-black" />
                                    <div className="flex-1 flex items-center justify-center border-b border-black text-center px-0.5">Patrón</div>
                                    <div className="flex-1 flex items-center justify-center border-b border-black text-center px-0.5">Muestra</div>
                                    <div className="flex-1 flex items-center justify-center text-center px-0.5">Δ</div>
                                </div>

                                {/* LAB table */}
                                <div className="flex-1 border-r border-black">
                                    <table className="w-full text-center text-[10px] h-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-black bg-gray-100 h-[20px]">
                                                <th className="border-r border-black w-1/3 text-[#b58000]">L*</th>
                                                <th className="border-r border-black w-1/3 text-red-600">a*</th>
                                                <th className="text-blue-600">b*</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-black">
                                                <td className="border-r border-black p-1 font-medium">{l1}</td>
                                                <td className="border-r border-black p-1 font-medium">{a1}</td>
                                                <td className="p-1 font-medium">{b1}</td>
                                            </tr>
                                            <tr className="border-b border-black">
                                                <td className="border-r border-black p-1 font-medium">{l2}</td>
                                                <td className="border-r border-black p-1 font-medium">{a2}</td>
                                                <td className="p-1 font-medium">{b2}</td>
                                            </tr>
                                            <tr className="font-bold bg-gray-100">
                                                <td className="border-r border-black p-1">{dL}</td>
                                                <td className="border-r border-black p-1">{dA}</td>
                                                <td className="p-1">{dB}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* ΔE value */}
                                <div className="w-[75px] border-r border-black flex flex-col items-center justify-center gap-1 px-1">
                                    <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wide">ΔE(CIE2000)</span>
                                    <span className="font-black text-[18px] leading-none" style={{ color: passColor }}>
                                        {dE.toFixed(2)}
                                    </span>
                                </div>

                                {/* Status */}
                                <div
                                    className="flex-1 flex flex-col items-center justify-center gap-1 font-black text-[11px] uppercase"
                                    style={{ backgroundColor: passColor, color: passTextColor }}
                                >
                                    {passStatus}
                                </div>
                            </div>
                        </div>

                        {/* ── Signature ── */}
                        <div className="w-full mt-16 pr-8 flex justify-end">
                            <div className="w-[200px] text-center">
                                <p className="mb-8 text-[9px] font-bold text-left ml-2 text-gray-600">Autorizado por:</p>
                                <div className="w-full border-t border-black" />
                                <p className="mt-1 text-[8px] text-gray-500">Firma y sello</p>
                            </div>
                        </div>

                        {/* ── Footer strip ── */}
                        <div className="mt-6 pt-2 border-t border-gray-300 flex justify-between text-[7px] text-gray-400">
                            <span>Quimresa Digital Color System v0.0.1 © {dateNow.getFullYear()}</span>
                            <span>Generado: {dateElaboracion}</span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
