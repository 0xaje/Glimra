import React, { useRef, useEffect } from 'react';
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
  const [showPreview, setShowPreview] = React.useState(false);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream, showPreview]);

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
        minWidth: '220px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                camera.status === 'tracking' && camera.faceDetected
                  ? 'var(--color-signal-active)'
                  : camera.status === 'paused'
                  ? 'var(--color-signal-warning)'
                  : camera.status === 'error'
                  ? 'var(--color-signal-danger)'
                  : 'var(--color-border-strong)',
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>
            {camera.status === 'tracking'
              ? 'Hands-free active'
              : camera.status === 'paused'
              ? 'Paused'
              : camera.status === 'initializing'
              ? 'Connecting…'
              : 'Error'}
          </span>
        </div>

        <button
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
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        {camera.validationMessage}
      </div>

      {/* Visual charge indicator for prolonged intentional blink dwell */}
      {chargeRatio > 0 && (
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
      {camera.lastGesture && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ✓ {camera.lastGesture.label}
        </div>
      )}

      {/* Align Camera Toggle & Mini Video Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
        <button
          onClick={() => setShowPreview((prev) => !prev)}
          style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            textAlign: 'left',
            padding: 0,
          }}
        >
          {showPreview ? 'Hide camera alignment' : 'Show camera alignment'}
        </button>

        {showPreview && videoStream && (
          <div
            style={{
              width: '100%',
              height: '110px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-base)',
              border: '1px solid var(--color-border-subtle)',
              position: 'relative',
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror view for natural presenter alignment
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
