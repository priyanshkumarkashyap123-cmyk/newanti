/**
 * ModalControls - UI for controlling modal animation
 * Play/Pause, Mode selector, Amplitude slider
 */

import React from 'react';
import { FC } from 'react';
import { useModelStore } from '../store/model';

export const ModalControls: FC = () => {
    const modalResults = useModelStore((state) => state.modalResults);
    const activeModeIndex = useModelStore((state) => state.activeModeIndex);
    const modeAmplitude = useModelStore((state) => state.modeAmplitude);
    const isAnimating = useModelStore((state) => state.isAnimating);
    const setActiveModeIndex = useModelStore((state) => state.setActiveModeIndex);
    const setModeAmplitude = useModelStore((state) => state.setModeAmplitude);
    const setIsAnimating = useModelStore((state) => state.setIsAnimating);

    if (!modalResults || modalResults.modes.length === 0) {
        return null;
    }

    const activeMode = modalResults.modes[activeModeIndex];

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 30, 50, 0.95)',
        padding: '12px 20px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid rgba(100, 150, 255, 0.3)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
    };

    const labelStyle: React.CSSProperties = {
        color: 'rgba(200, 220, 255, 0.9)',
        fontSize: '13px',
        fontWeight: 500
    };

    const valueStyle: React.CSSProperties = {
        color: '#4fc3f7',
        fontSize: '14px',
        fontWeight: 600,
        minWidth: '80px'
    };

    const buttonStyle: React.CSSProperties = {
        background: isAnimating
            ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)'  // Red for pause
            : 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',  // Green for play
        border: 'none',
        borderRadius: '8px',
        padding: '8px 16px',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease'
    };

    const selectStyle: React.CSSProperties = {
        background: 'rgba(50, 70, 100, 0.8)',
        border: '1px solid rgba(100, 150, 255, 0.3)',
        borderRadius: '6px',
        padding: '6px 10px',
        color: 'white',
        fontSize: '13px',
        cursor: 'pointer'
    };

    const sliderStyle: React.CSSProperties = {
        width: '100px',
        accentColor: '#4fc3f7'
    };

    return (
        <div style={containerStyle}>
            {/* Play/Pause Button */}
            <button type="button"
                style={buttonStyle}
                onClick={() => setIsAnimating(!isAnimating)}
            >
                {isAnimating ? '⏸️ Pause' : '▶️ Play'}
            </button>

            <div style={{ width: '1px', height: '30px', background: 'rgba(100, 150, 255, 0.3)' }} />

            {/* Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={labelStyle}>Mode:</span>
                <select
                    style={selectStyle}
                    value={activeModeIndex}
                    onChange={(e) => setActiveModeIndex(Number(e.target.value))}
                >
                    {modalResults.modes.map((mode, i) => (
                        <option key={i} value={i}>
                            Mode {mode.modeNumber}
                        </option>
                    ))}
                </select>
            </div>

            {/* Frequency Display */}
            {activeMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={labelStyle}>Frequency:</span>
                    <span style={valueStyle}>{activeMode.frequency.toFixed(2)} Hz</span>
                </div>
            )}

            {/* Period Display */}
            {activeMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={labelStyle}>Period:</span>
                    <span style={valueStyle}>{activeMode.period.toFixed(3)} s</span>
                </div>
            )}

            <div style={{ width: '1px', height: '30px', background: 'rgba(100, 150, 255, 0.3)' }} />

            {/* Amplitude Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={labelStyle}>Amplitude:</span>
                <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={modeAmplitude}
                    onChange={(e) => setModeAmplitude(Number(e.target.value))}
                    style={sliderStyle}
                />
                <span style={{ color: '#4fc3f7', fontSize: '12px', minWidth: '30px' }}>
                    {modeAmplitude.toFixed(1)}x
                </span>
            </div>
        </div>
    );
};

export default ModalControls;
