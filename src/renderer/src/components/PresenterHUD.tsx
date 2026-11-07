import React, { useRef, useEffect, useState } from 'react';
import { CameraState } from '../types';

interface PresenterHUDProps {
  camera: CameraState;
  chargeRatio: number;
  videoStream: MediaStream | null;
  onTogglePause: () => void;
}

export const PresenterHUD: React.FC<PresenterHUDProps> = ({
  camera,
  chargeRatio,
  videoStream,
  onTogglePause,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (videoRef.current && videoStream && showPreview) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream, showPreview]);

  if (!camera.isActive) return null;

  const isTracking = camera.status === 'tracking' && camera.faceDetected;
  const isPaused = camera.status === 'paused';
  const isError = camera.status === 'error';

  return (
    <aside
      aria-label="Hands-free gesture telemetry"
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--studio-overlay)',
        border: '1px solid var(--studio-rule-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 50,
        minWidth: '240px',
        maxWidth: '300px',
      }}
    >
      {/* Telemetry Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${
                isTracking
                  ? 'var(--studio-signal-active)'
                  : isPaused
                  ? 'var(--studio-signal-warning)'
                  : isError
                  ? 'var(--studio-signal-alert)'
                  : 'var(--studio-rule)'
              }`,
              color: isTracking
                ? 'var(--studio-signal-active)'
                : isPaused
                ? 'var(--studio-signal-warning)'
                : isError
                ? 'var(--studio-signal-alert)'
                : 'var(--studio-ink-secondary)',
              backgroundColor: isTracking
                ? 'var(--studio-signal-active-subtle)'
                : isPaused
                ? 'var(--studio-signal-warning-subtle)'
                : isError
                ? 'var(--studio-signal-alert-subtle)'
                : 'transparent',
            }}
          >
            {isTracking ? 'LOCKED' : isPaused ? 'PAUSED' : isError ? 'ALERT' : 'INIT'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--studio-ink-primary)' }}>
            SmartSpectra
          </span>
        </div>

        <button
          onClick={onTogglePause}
          style={{
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--studio-rule)',
            backgroundColor: 'var(--studio-elevated)',
            fontSize: '11px',
            color: 'var(--studio-ink-secondary)',
          }}
          title="Press Space or P to toggle pause"
        >
          {camera.status === 'paused' ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Validation / Calibration Status */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--studio-ink-secondary)',
          lineHeight: 1.4,
        }}
      >
        {camera.validationMessage}
      </div>

      {/* Intentional Dwell Blink Charge Progress Indicator */}
      {chargeRatio > 0 && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(chargeRatio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Intentional dwell advance charge"
          style={{
            height: '4px',
            width: '100%',
            backgroundColor: 'var(--studio-subtle)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.round(chargeRatio * 100))}%`,
              backgroundColor: 'var(--studio-amber)',
              transition: 'width 60ms linear',
            }}
          />
        </div>
      )}

      {/* Last Triggered Gesture Event Feedback */}
      {camera.lastGesture && (
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--studio-elevated)',
            border: '1px solid var(--studio-rule)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--studio-amber)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            {camera.lastGesture.label ||
              (camera.lastGesture.type === 'prolonged-blink'
                ? 'Dwell Advance'
                : camera.lastGesture.type === 'double-blink'
                ? 'Double-Blink Rewind'
                : 'Gesture Detected')}
          </span>
          <span style={{ color: 'var(--studio-ink-muted)' }}>confirmed</span>
        </div>
      )}

      {/* Optional Optical Alignment Preview Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--studio-rule)',
          paddingTop: '8px',
        }}
      >
        <button
          onClick={() => setShowPreview((prev) => !prev)}
          style={{
            fontSize: '11px',
            color: 'var(--studio-ink-muted)',
            textDecoration: 'none',
          }}
        >
          {showPreview ? 'Hide optical preview' : 'Show optical preview'}
        </button>
      </div>

      {showPreview && (
        <div
          style={{
            width: '100%',
            height: '110px',
            backgroundColor: 'var(--studio-bg)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            border: '1px solid var(--studio-rule)',
            position: 'relative',
          }}
        >
          {videoStream ? (
            <video
              ref={videoRef}
              muted
              playsInline
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100%25' height='100%25' fill='%2311141a'/%3E%3C/svg%3E"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: '11px',
                color: 'var(--studio-ink-muted)',
              }}
            >
              Camera stream standby
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
