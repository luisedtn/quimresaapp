import React, { useRef, useState } from 'react';
import { X, Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { format, addYears } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface GenerarPDFProps {
    onClose: () => void;
    qcContextData: any;
}

export default function GenerarPDF({ onClose, qcContextData }: GenerarPDFProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Parse required data
    const formulaName = qcContextData?.formulaName || 'Fórmula Encontrada';
    const codigo = qcContextData?.sample?.name || 'GEN-01'; // Fallback if no real source
    const client = 'MADEVAL'; // Default mockup as requested
    const quantity = `${qcContextData?.prepareAmount || 1} LT`;
    const density = '1.42'; // Mockup, could compute from components if needed
    const viscosity = '0` 59.9``'; // Mockup

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

    const patronHex = qcContextData?.standard?.hex || '#ffffff';
    const sampleHex = qcContextData?.sample?.hex || '#ffffff';

    const dateNow = new Date();
    const dateElaboracion = format(dateNow, 'dd/MM/yy, hh:mm:ss a');
    const datePreparacion = format(dateNow, 'dd/MM/yy, hh:mm:ss a');
    const dateCaducidad = format(addYears(dateNow, 3), 'dd/MM/yy');

    // Lógica del mapa CIELAB
    const dA_val = parseFloat(dA);
    const dB_val = parseFloat(dB);
    const distAb = Math.sqrt(dA_val * dA_val + dB_val * dB_val);
    const chartMax = Math.max(2, Math.ceil(distAb));

    let plotX = 50 + (dA_val / chartMax) * 50;
    let plotY = 50 - (dB_val / chartMax) * 50;
    plotX = Math.max(0, Math.min(100, plotX));
    plotY = Math.max(0, Math.min(100, plotY));

    const maxL = 1.0; // En la imagen, el L bar muestra de -1.00 a 1.00
    let plotL = 50 + (parseFloat(dL) / maxL) * 50;
    plotL = Math.max(0, Math.min(100, plotL));

    const ringStep = chartMax / 4; // 4 rings as in the image sample
    const rings = Array.from({ length: 4 }, (_, i) => (i + 1) * ringStep);

    const passStatus = dE <= 1.0 ? 'EXCELENTE' : dE <= 3.0 ? 'BUENO' : 'NO PASA';
    const passColor = dE <= 1.0 ? 'bg-[#73ff73]' : dE <= 3.0 ? 'bg-[#ffff73]' : 'bg-[#ff0000] text-black';

    const handleGeneratePDF = async () => {
        if (!printRef.current) return;
        setIsGenerating(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 3, // High resolution
                useCORS: true,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const pdfDataUri = pdf.output('datauristring');
            // jsPDF puede incluir: data:application/pdf;filename=generated.pdf;base64,JVBERi...
            // Necesitamos extraer solo la parte pura de base64
            const pdfBase64 = pdfDataUri.split('base64,')[1];
            console.log('[GenerarPDF] Base64 extraído correctamente. Longitud:', pdfBase64?.length);
            const loteFinal = '030226MXPUHAAA'; // El lote asignado

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

            alert('PDF guardado correctamente en el servidor');
            onClose();
        } catch (e) {
            console.error('Error generating PDF:', e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-start bg-slate-900 overflow-y-auto w-full">
            {/* Top Banner Actions */}
            <div className="w-full bg-slate-950 p-4 sticky top-0 z-[250] flex items-center justify-between shadow-2xl">
                <h2 className="text-white font-bold flex items-center gap-2 uppercase tracking-wide">
                    <Printer className="w-4 h-4 text-violet-400" /> Previsualización de Informe
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="p-2 border border-slate-700 bg-slate-900 rounded-lg text-slate-300 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleGeneratePDF}
                        disabled={isGenerating}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all disabled:opacity-50"
                    >
                        {isGenerating ? 'Guardando...' : 'Guardar PDF'}
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* A4 Paper Canvas */}
            <div className="py-8 bg-slate-800 w-full min-h-screen flex justify-center">
                <div
                    className="bg-white shadow-2xl border border-slate-300"
                    style={{ width: '210mm', minHeight: '279.4mm', padding: '5mm 5mm' }}
                >
                    {/* Virtual Target to render to canvas */}
                    <div ref={printRef} className="w-full h-full bg-white text-black font-sans leading-tight">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-1 font-black text-3xl tracking-tighter">
                                <span className="text-orange-500 font-sans">Q</span>uimresa
                            </div>
                            <div className="text-right text-[10px] font-bold">
                                <p>QUIMRESA CIA LTDA. GABRIEL GARCIA MORENO Y DOLORES CACUANGO</p>
                                <p>Tels: +(593) 999834752</p>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-[10px] mb-6 border-t border-black pt-4">
                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Código</p>
                                <p className="font-bold text-xs">{codigo}</p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Fecha de elaboración</p>
                                <p className="font-bold text-[10px]">{dateElaboracion}</p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Fecha de preparación</p>
                                <p className="font-bold text-[10px]">{datePreparacion}</p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Fecha de caducidad</p>
                                <p className="font-bold text-[10px]">{dateCaducidad}</p>
                            </div>

                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Lote</p>
                                <p className="font-bold text-[11px] font-mono">030226MXPUHAAA</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-600 mb-1 border-b border-black">Cliente</p>
                                <p className="font-bold text-[11px] uppercase">{client}</p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Cantidad</p>
                                <p className="font-bold text-[11px]">{quantity}</p>
                            </div>

                            <div className="col-span-1">
                                <p className="text-gray-600 mb-1 border-b border-black">Densidad</p>
                                <p className="font-bold text-[11px]">{density}</p>
                            </div>
                            <div className="col-span-3">
                                <p className="text-gray-600 mb-1 border-b border-black">Nombre de fórmula</p>
                                <p className="font-bold text-[11px] uppercase">{formulaName}</p>
                            </div>

                            <div className="col-span-1 border-gray-300">
                                <p className="text-gray-600 mb-1 border-b border-black">Viscosidad</p>
                                <p className="font-bold text-[11px]">{viscosity}</p>
                            </div>
                        </div>

                        {/* Graphics Table */}
                        <div className="border border-black flex flex-col mb-4">
                            {/* Graphics Row */}
                            <div className="flex h-56 border-b border-black">

                                {/* 1. Header Rotated */}
                                <div className="w-[30px] border-r border-black flex items-center justify-center bg-gray-100/50 relative overflow-hidden">
                                    <span className="-rotate-90 whitespace-nowrap font-black text-sm tracking-widest min-w-[200px] text-center transform inline-block">
                                        CONTROL CALIDAD
                                    </span>
                                </div>

                                {/* 2. LAB Chart */}
                                <div className="flex-1 border-r border-black relative bg-white">
                                    <div className="absolute inset-0 flex items-center justify-center p-2">
                                        <div className="relative w-full max-w-[190px] aspect-square">
                                            {/* Lines */}
                                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black -translate-x-1/2"></div>
                                            <div className="absolute left-0 right-0 top-1/2 h-px bg-black -translate-y-1/2"></div>

                                            {/* Labels */}
                                            <span className="absolute top-0 left-1/2 ml-1 text-[8px] font-bold">b</span>
                                            <span className="absolute bottom-0 left-1/2 ml-1 text-[8px] font-bold">-b</span>
                                            <span className="absolute right-0 top-1/2 mt-1 mr-1 text-[8px] font-bold">a</span>
                                            <span className="absolute left-0 top-1/2 mt-1 ml-1 text-[8px] font-bold">-a</span>

                                            {/* Concentric rings */}
                                            {rings.map((val) => (
                                                <div key={val} className="absolute inset-0 pointer-events-none">
                                                    <div
                                                        className="absolute top-1/2 left-1/2 rounded-full border border-black/80"
                                                        style={{
                                                            width: `${(val / chartMax) * 100}%`,
                                                            height: `${(val / chartMax) * 100}%`,
                                                            transform: 'translate(-50%, -50%)'
                                                        }}
                                                    ></div>
                                                    <div className="absolute top-1/2 left-1/2 w-1/2 border-t border-dashed border-gray-400"
                                                        style={{ transform: `translate(0%, ${-((val / chartMax) * 50)}%)` }}
                                                    ></div>
                                                    <span className="absolute text-[3px] text-black" style={{
                                                        top: `${50 - ((val / chartMax) * 50)}%`, left: '92%', transform: 'translate(4px, -50%)'
                                                    }}>
                                                        {val.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}

                                            {/* Center (Standard) */}
                                            <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-yellow-400 border border-black z-10 -translate-x-1/2 -translate-y-1/2"></div>
                                            {/* Plot Dot (Sample) */}
                                            <div
                                                className="absolute w-2 h-2 bg-yellow-400 rounded-full border border-black z-20"
                                                style={{
                                                    left: `${plotX}%`,
                                                    top: `${plotY}%`,
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. L Component Bar */}
                                <div className="w-[75px] border-r border-black relative flex flex-col justify-center items-center overflow-visible">
                                    <div className="h-[80%] w-[2px] bg-black bg-gradient-to-b from-white via-gray-500 to-black border border-black relative">
                                        {/* Scale lines */}
                                        {[-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1].reverse().map((level, idx) => (
                                            <div key={idx} className="absolute w-[20px] h-[1px] bg-black" style={{ top: `${idx * 10}%`, left: '-10px' }}>
                                                <span className="absolute text-[6px] left-[25px] transform -translate-y-[2px] w-[20px]">{level.toFixed(2)}</span>
                                                {level === 1 && <span className="absolute text-[4px] -left-[25px] font-bold -translate-y-[2px] w-[25px]">L 1.00</span>}
                                                {level === 0 && <span className="absolute text-[4px] -left-[25px] font-bold -translate-y-[2px] w-[25px]">L 0.00</span>}
                                                {level === -1 && <span className="absolute text-[4px] -left-[26px] font-bold -translate-y-[2px] w-[27px]">L -1.00</span>}
                                            </div>
                                        ))}

                                        {Math.abs(parseFloat(dL)) <= 1.0 && (
                                            <div
                                                className="absolute w-6 h-1 border-[1.5px] border-black bg-yellow-400 shadow-sm z-30"
                                                style={{ top: `${100 - plotL}%`, left: '-12px', transform: 'translateY(-50%)' }}
                                            >
                                                <div className="absolute w-2 h-2 bg-yellow-400 border border-black rounded-full top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%]"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 4. Color Box */}
                                <div className="flex-1 w-full relative flex overflow-hidden">
                                    {/* Background split (Muestra | Patrón) */}
                                    <div className="w-1/2 h-full" style={{ backgroundColor: sampleHex }}></div>
                                    <div className="w-1/2 h-full" style={{ backgroundColor: patronHex }}></div>

                                    {/* Center Circle split (Patrón | Muestra) */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[170px] aspect-square rounded-full overflow-hidden flex border border-black/10 shadow-sm">
                                        <div className="w-1/2 h-full" style={{ backgroundColor: patronHex }}></div>
                                        <div className="w-1/2 h-full" style={{ backgroundColor: sampleHex }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Data Rows */}
                            <div className="flex border-b border-black bg-gray-100/30 min-h-[80px]">
                                {/* 1. Labels column (matches 30px rotated header) */}
                                <div className="w-[30px] border-r border-black flex flex-col text-[5px] font-bold pt-[1px] pl-[1px] leading-tight">
                                    <div className="h-[21px] border-b border-black"></div>
                                    <div className="flex-1 flex items-center px-1 border-b border-black">Patrón</div>
                                    <div className="flex-1 flex items-center px-1 border-b border-black">Muestra</div>
                                    <div className="flex-1 flex items-center px-1">Δ/δ</div>
                                </div>

                                {/* 2. Data table (matches flex-1 LAB chart) */}
                                <div className="flex-1">
                                    <table className="w-full text-center text-[10px] h-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-black font-bold h-[20px]">
                                                <th className="border-r border-black w-1/3">L</th>
                                                <th className="border-r border-black w-1/3">a</th>
                                                <th className="">b</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-black font-medium">
                                                <td className="border-r border-black p-1">{l1}</td>
                                                <td className="border-r border-black p-1">{a1}</td>
                                                <td className="p-1">{b1}</td>
                                            </tr>
                                            <tr className="border-b border-black font-medium">
                                                <td className="border-r border-black p-1">{l2}</td>
                                                <td className="border-r border-black p-1">{a2}</td>
                                                <td className="p-1">{b2}</td>
                                            </tr>
                                            <tr className="font-bold">
                                                <td className="border-r border-black p-1">{dL}</td>
                                                <td className="border-r border-black p-1">{dA}</td>
                                                <td className="p-1">{dB}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* 3. dE Value (matches 75px L bar) */}
                                <div className="w-[75px] border-l border-black flex items-center justify-center font-black text-[14px]">
                                    {dE.toFixed(2)}
                                </div>

                                {/* 4. Status Cell (matches flex-1 Color Box) */}
                                <div className={`flex-1 border-l border-black flex items-center justify-center font-black text-[12px] ${passColor} uppercase`}>
                                    {passStatus}
                                </div>
                            </div>
                        </div>

                        {/* Signature Space */}
                        <div className="w-full mt-24 pr-12 flex justify-end">
                            <div className="w-[200px] text-center">
                                <p className="mb-10 text-[9px] font-bold text-left ml-2">Autorizado por:</p>
                                <div className="w-full border-t border-black"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
