import { useEffect, useState } from 'react';
import { CameraState } from '../types';
import type { GestureControlMode } from '../engine/presageNativeController';

interface PresenterHUDProps {
  camera: CameraState;
  chargeRatio: number;
  onTogglePause: () => void;
  controlMode: GestureControlMode;
  trackingReady: boolean;
}

export function PresenterHUD({
  camera,
  chargeRatio,
  onTogglePause,
  controlMode,
  trackingReady,
}: PresenterHUDProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [, refreshGestureFeedback] = useState(0);

  // Do not leave a stale "Head up" / "Head down" action visible for minutes.
  useEffect(() => {
    if (!camera.lastGesture) return;
    const id = window.setTimeout(() => refreshGestureFeedback(value => value + 1), 2400);
    return () => window.clearTimeout(id);
  }, [camera.lastGesture]);


  if (!camera.isActive) return null;

  return (
    <aside
      aria-label="Gesture control status"
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-overlay)',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 50,
        width: showDetails ? '310px' : '275px',
        maxWidth: 'calc(100% - 32px)',
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${
                camera.status === 'tracking'
                  ? 'var(--color-signal-active)'
                  : camera.status === 'paused'
                  ? 'var(--color-signal-warning)'
                  : camera.status === 'error'
                  ? 'var(--color-signal-danger)'
                  : 'var(--color-border-strong)'
              }`,
              color:
                camera.status === 'tracking'
                  ? 'var(--color-signal-active)'
                  : camera.status === 'paused'
                  ? 'var(--color-signal-warning)'
                  : camera.status === 'error'
                  ? 'var(--color-signal-danger)'
                  : 'var(--color-text-muted)',
            }}
          >
            {camera.status === 'tracking'
              ? (controlMode === 'eyes' ? (camera.faceDetected ? 'READY' : 'WAIT') : trackingReady ? 'READY' : 'WAIT')
              : camera.status === 'paused'
              ? 'PAUSED'
              : camera.status === 'initializing'
              ? 'INIT'
              : 'OFFLINE'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {camera.status === 'tracking'
              ? (controlMode === 'eyes' ? 'Eye control' : trackingReady ? 'Presage head ready' : 'Starting gestures…')
              : camera.status === 'paused'
              ? 'Paused'
              : camera.status === 'initializing'
              ? 'Connecting…'
              : 'Error'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => { setShowDetails(value => !value); }}
          aria-expanded={showDetails}
          style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}
        >{showDetails ? 'Less' : 'Details'}</button>
        <button
          disabled={camera.status !== 'tracking' && camera.status !== 'paused'}
          onClick={onTogglePause}
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated)',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
          }}
          title="Press Space or P to toggle pause"
        >
          {camera.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Status message */}
      {showDetails ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {camera.validationMessage}
        </div>
      ) : /SmartSpectra unavailable|SmartSpectra processing failed|SmartSpectra credits/i.test(camera.validationMessage) ? (
        <div style={{ fontSize: '11px', color: 'var(--color-signal-warning)' }}>
          SmartSpectra readings unavailable
        </div>
      ) : null}

      {showDetails && camera.status === 'tracking' && controlMode === 'head' && trackingReady && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Gentle Presage head gestures: left/right = slides, up/down = scroll
        </div>
      )}

      {/* Optional SmartSpectra eye mode only: hold and release blink. */}
      {showDetails && camera.status === 'tracking' && controlMode === 'eyes' && camera.faceDetected && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {chargeRatio >= 1 ? 'Ready — open your eyes to change slide' : chargeRatio > 0 ? 'Keep eyes closed until ready' : 'Hold eyes closed, then open to move forward'}
        </div>
      )}
      {/* Visual charge indicator for prolonged intentional blink dwell */}
      {showDetails && controlMode === 'eyes' && chargeRatio > 0 && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(chargeRatio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            width: '100%',
            height: '3px',
            backgroundColor: 'var(--color-border-subtle)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(chargeRatio * 100)}%`,
              height: '100%',
              backgroundColor: 'var(--color-accent)',
            }}
          />
        </div>
      )}

      {/* Last triggered gesture feedback toast */}
      {camera.lastGesture && Date.now() - camera.lastGesture.timestamp < 2400 && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {camera.lastGesture.label}
        </div>
      )}

      {showDetails && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Source: Presage SmartSpectra native camera (real SDK data).
          Camera frames and face coordinates are not sent to this screen.
        </div>
      )}
    </aside>
  );
}
