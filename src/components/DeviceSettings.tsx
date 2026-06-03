import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Check, ChevronDown, Info, Cpu, Layers, Sliders, Hash, Loader2 } from 'lucide-react';

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

export type ReferenceWhite =
    | 'D50/2°' | 'D65/10°' | 'A/2°' | 'A/10°' | 'C/2°' | 'C/10°'
    | 'D50/10°' | 'D55/2°' | 'D55/10°' | 'D65/2°' | 'D75/2°' | 'D75/10°'
    | 'F2/2°' | 'F2/10°' | 'F7/2°' | 'F7/10°' | 'F11/2°' | 'F11/10°';

export type MeasurementMode = 'M0' | 'M1' | 'M2';

export type DisplayColorField =
    | 'CIELAB' | 'CIEXYZ' | 'CMYK' | 'Density' | 'HTX' | 'LRV' | 'LCH(ab)' | 'sRGB';

export type DensityStatus = 'ISO Status A' | 'ISO Status E' | 'ISO Status I' | 'ISO Status T';

export type MultiPointAveraging = 1 | 2 | 3 | 4 | 5;

export type MeasurementTrigger = 'auto' | 'manual';

export interface DeviceSettingsData {
    referenceWhite: ReferenceWhite;
    measurementMode: MeasurementMode;
    displayColorFields: DisplayColorField[];
    densityStatus: DensityStatus;
    multiPointAveraging: MultiPointAveraging;
    measurementTrigger: MeasurementTrigger;
}

export const DEFAULT_SETTINGS: DeviceSettingsData = {
    referenceWhite: 'D50/2°',
    measurementMode: 'M2',
    displayColorFields: ['CIELAB', 'HTX', 'sRGB'],
    densityStatus: 'ISO Status T',
    multiPointAveraging: 1,
    measurementTrigger: 'manual',
};

const REFERENCE_WHITES: ReferenceWhite[] = [
    'D50/2°', 'D65/10°', 'A/2°', 'A/10°', 'C/2°', 'C/10°',
    'D50/10°', 'D55/2°', 'D55/10°', 'D65/2°', 'D75/2°', 'D75/10°',
    'F2/2°', 'F2/10°', 'F7/2°', 'F7/10°', 'F11/2°', 'F11/10°',
];

const MEASUREMENT_MODES: { value: MeasurementMode; label: string; desc: string }[] = [
    { value: 'M0', label: 'M0', desc: 'Sin polarización' },
    { value: 'M1', label: 'M1', desc: 'D50 simulado' },
    { value: 'M2', label: 'M2', desc: 'UV excluido (estándar)' },
];

const DISPLAY_COLOR_FIELDS: { value: DisplayColorField; desc: string }[] = [
    { value: 'CIELAB', desc: 'L* a* b*' },
    { value: 'CIEXYZ', desc: 'X Y Z' },
    { value: 'CMYK', desc: 'C M Y K' },
    { value: 'Density', desc: 'Status A/E/I/T' },
    { value: 'HTX', desc: 'Hex Color' },
    { value: 'LRV', desc: 'Light Reflectance Value' },
    { value: 'LCH(ab)', desc: 'L* C* H°' },
    { value: 'sRGB', desc: 'R G B' },
];

const DENSITY_STATUSES: DensityStatus[] = [
    'ISO Status A', 'ISO Status E', 'ISO Status I', 'ISO Status T',
];

const AVERAGING_OPTIONS: MultiPointAveraging[] = [1, 2, 3, 4, 5];

// ============================================================
// PERSISTENCIA DE AJUSTES
// ============================================================

const SETTINGS_KEY = 'nix_device_settings';

export function loadSettings(): DeviceSettingsData {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: DeviceSettingsData): void {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { }
}

// ============================================================
// COMPONENTES INTERNOS
// ============================================================

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="nix-settings__section-header">
            <span className="nix-settings__section-icon">{icon}</span>
            <span className="nix-settings__section-title">{title}</span>
        </div>
    );
}

function RadioOption({
    label,
    desc,
    checked,
    onChange,
    id,
}: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: () => void;
    id: string;
}) {
    return (
        <label
            htmlFor={id}
            className={`nix-settings__radio-row${checked ? ' nix-settings__radio-row--active' : ''}`}
            onClick={onChange}
        >
            <span className={`nix-settings__radio-dot${checked ? ' nix-settings__radio-dot--active' : ''}`}>
                {checked && <span className="nix-settings__radio-inner" />}
            </span>
            <span className="nix-settings__radio-label">
                {label}
                {desc && <span className="nix-settings__radio-desc"> — {desc}</span>}
            </span>
        </label>
    );
}

function CheckboxOption({
    label,
    desc,
    checked,
    onChange,
    id,
}: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: () => void;
    id: string;
}) {
    return (
        <label
            htmlFor={id}
            className={`nix-settings__check-row${checked ? ' nix-settings__check-row--active' : ''}`}
            onClick={onChange}
        >
            <span className={`nix-settings__checkbox${checked ? ' nix-settings__checkbox--active' : ''}`}>
                {checked && <Check size={10} strokeWidth={3} />}
            </span>
            <span className="nix-settings__check-label">
                {label}
                {desc && <span className="nix-settings__check-desc"> — {desc}</span>}
            </span>
        </label>
    );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface DeviceSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    isConnected?: boolean;
    onSettingsChange?: (settings: DeviceSettingsData) => void;
}

export default function DeviceSettings({
    isOpen,
    onClose,
    isConnected = false,
    onSettingsChange,
}: DeviceSettingsProps) {
    const [settings, setSettings] = useState<DeviceSettingsData>(loadSettings);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [refExpanded, setRefExpanded] = useState(false);

    // Reset to saved state when opening
    useEffect(() => {
        if (isOpen) {
            setSettings(loadSettings());
            setSaved(false);
        }
    }, [isOpen]);

    const handleApply = useCallback(async () => {
        setSaving(true);
        try {
            saveSettings(settings);
            onSettingsChange?.(settings);
            // Simulate async device communication if connected
            if (isConnected) {
                await new Promise(r => setTimeout(r, 600));
            }
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                onClose();
            }, 900);
        } finally {
            setSaving(false);
        }
    }, [settings, isConnected, onSettingsChange, onClose]);

    const toggleField = useCallback((field: DisplayColorField) => {
        setSettings(prev => {
            const has = prev.displayColorFields.includes(field);
            return {
                ...prev,
                displayColorFields: has
                    ? prev.displayColorFields.filter(f => f !== field)
                    : [...prev.displayColorFields, field],
            };
        });
    }, []);

    const handleReset = useCallback(() => {
        setSettings({ ...DEFAULT_SETTINGS });
    }, []);

    // Close on backdrop click
    const handleBackdrop = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="nix-settings__backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={handleBackdrop}
                    aria-modal="true"
                    role="dialog"
                    aria-label="Configuración del dispositivo"
                >
                    <motion.div
                        className="nix-settings__panel"
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ── Header ── */}
                        <div className="nix-settings__header">
                            <div className="nix-settings__header-left">
                                <div className="nix-settings__header-icon-wrap">
                                    <Settings size={17} />
                                </div>
                                <div>
                                    <h2 className="nix-settings__title">Configuración</h2>
                                    <p className="nix-settings__subtitle">Parámetros del dispositivo Nix</p>
                                </div>
                            </div>
                            <button
                                id="nix-settings-close"
                                className="nix-settings__close-btn"
                                onClick={onClose}
                                aria-label="Cerrar configuración"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* ── Device Status pill ── */}
                        <div className="nix-settings__status-row">
                            <span className={`nix-settings__status-pill${isConnected ? ' nix-settings__status-pill--connected' : ''}`}>
                                <span className={`nix-settings__status-dot${isConnected ? ' nix-settings__status-dot--connected' : ''}`} />
                                {isConnected ? 'Dispositivo conectado' : 'Sin conexión'}
                            </span>
                            {!isConnected && (
                                <span className="nix-settings__status-note">
                                    Los ajustes se aplicarán al conectar
                                </span>
                            )}
                        </div>

                        {/* ── Scrollable body ── */}
                        <div className="nix-settings__body">

                            {/* ── 1. Reference White ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Layers size={14} />} title="Blanco de referencia" />
                                <button
                                    className="nix-settings__ref-toggle"
                                    onClick={() => setRefExpanded(v => !v)}
                                    id="nix-settings-ref-toggle"
                                >
                                    <span className="nix-settings__ref-selected">{settings.referenceWhite}</span>
                                    <ChevronDown
                                        size={15}
                                        className={`nix-settings__ref-chevron${refExpanded ? ' nix-settings__ref-chevron--open' : ''}`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {refExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22 }}
                                            className="nix-settings__ref-list-wrap"
                                        >
                                            <div className="nix-settings__ref-list">
                                                {REFERENCE_WHITES.map(rw => (
                                                    <RadioOption
                                                        key={rw}
                                                        id={`ref-${rw}`}
                                                        label={rw}
                                                        checked={settings.referenceWhite === rw}
                                                        onChange={() => {
                                                            setSettings(prev => ({ ...prev, referenceWhite: rw }));
                                                            setRefExpanded(false);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </section>

                            <div className="nix-settings__divider" />

                            {/* ── 2. Measurement Modes ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Cpu size={14} />} title="Modos de medición" />
                                <div className="nix-settings__list">
                                    {MEASUREMENT_MODES.map(mode => (
                                        <RadioOption
                                            key={mode.value}
                                            id={`mode-${mode.value}`}
                                            label={mode.label}
                                            desc={mode.desc}
                                            checked={settings.measurementMode === mode.value}
                                            onChange={() => setSettings(prev => ({ ...prev, measurementMode: mode.value }))}
                                        />
                                    ))}
                                </div>
                            </section>

                            <div className="nix-settings__divider" />

                            {/* ── 3. Display Color Fields ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Sliders size={14} />} title="Campos de color a mostrar" />
                                <div className="nix-settings__list">
                                    {DISPLAY_COLOR_FIELDS.map(f => (
                                        <CheckboxOption
                                            key={f.value}
                                            id={`field-${f.value}`}
                                            label={f.value}
                                            desc={f.desc}
                                            checked={settings.displayColorFields.includes(f.value)}
                                            onChange={() => toggleField(f.value)}
                                        />
                                    ))}
                                </div>
                            </section>

                            <div className="nix-settings__divider" />

                            {/* ── 4. Density ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Info size={14} />} title="Densidad" />
                                <div className="nix-settings__list">
                                    {DENSITY_STATUSES.map(ds => (
                                        <RadioOption
                                            key={ds}
                                            id={`density-${ds}`}
                                            label={ds}
                                            checked={settings.densityStatus === ds}
                                            onChange={() => setSettings(prev => ({ ...prev, densityStatus: ds }))}
                                        />
                                    ))}
                                </div>
                            </section>

                            <div className="nix-settings__divider" />

                            {/* ── 5. Multi-Point Averaging ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Hash size={14} />} title="Promedio multi-punto" />
                                <div className="nix-settings__list">
                                    {AVERAGING_OPTIONS.map(n => (
                                        <RadioOption
                                            key={n}
                                            id={`avg-${n}`}
                                            label={String(n)}
                                            desc={n === 1 ? 'Sin promedio' : `Promedio de ${n} mediciones`}
                                            checked={settings.multiPointAveraging === n}
                                            onChange={() => setSettings(prev => ({ ...prev, multiPointAveraging: n as MultiPointAveraging }))}
                                        />
                                    ))}
                                </div>
                            </section>

                            <div className="nix-settings__divider" />

                            {/* ── 6. Measurement Trigger ── */}
                            <section className="nix-settings__section">
                                <SectionHeader icon={<Cpu size={14} />} title="Modo de captura" />
                                <div className="nix-settings__list">
                                    <RadioOption
                                        id="trigger-manual"
                                        label="Manual"
                                        desc="El usuario presiona el botón para cada medición"
                                        checked={settings.measurementTrigger === 'manual'}
                                        onChange={() => setSettings(prev => ({ ...prev, measurementTrigger: 'manual' }))}
                                    />
                                    <RadioOption
                                        id="trigger-auto"
                                        label="Automático"
                                        desc="Las mediciones se toman automáticamente al detectar el dispositivo"
                                        checked={settings.measurementTrigger === 'auto'}
                                        onChange={() => setSettings(prev => ({ ...prev, measurementTrigger: 'auto' }))}
                                    />
                                </div>
                            </section>

                            {/* Bottom padding */}
                            <div style={{ height: 24 }} />
                        </div>

                        {/* ── Footer actions ── */}
                        <div className="nix-settings__footer">
                            <button
                                className="nix-settings__reset-btn"
                                onClick={handleReset}
                                disabled={saving}
                                id="nix-settings-reset"
                            >
                                Restablecer
                            </button>
                            <button
                                className={`nix-settings__apply-btn${saved ? ' nix-settings__apply-btn--saved' : ''}`}
                                onClick={handleApply}
                                disabled={saving || saved}
                                id="nix-settings-apply"
                            >
                                {saving ? (
                                    <><Loader2 size={14} className="nix-settings__apply-spinner" /> Aplicando…</>
                                ) : saved ? (
                                    <><Check size={14} /> Guardado</>
                                ) : (
                                    'Aplicar'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
