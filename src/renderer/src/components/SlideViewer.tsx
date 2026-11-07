import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PresentationDocument } from '../engine/pdfEngine';

interface SlideViewerProps {
  document: PresentationDocument | null;
  currentSlide: number;
  totalSlides: number;
  fileName: string | null;
  onNext: () => void;
  onPrev: () => void;
  onJumpToSlide?: (slideNumber: number) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  isBlackout?: boolean;
  onToggleBlackout?: () => void;
  embedded?: boolean;
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  document: doc,
  currentSlide,
  totalSlides,
  fileName,
  onNext,
  onPrev,
  onJumpToSlide,
  onToggleFullscreen,
  isFullscreen,
  isBlackout = false,
  onToggleBlackout,
  embedded = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  // Presenter Elapsed Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpInput, setJumpInput] = useState(String(currentSlide));

  useEffect(() => {
    setJumpInput(String(currentSlide));
  }, [currentSlide]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderCurrentPage = useCallback(async () => {
    if (!doc || !canvasRef.current || !containerRef.current) return;

    try {
      setIsRendering(true);
      setRenderError(null);

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // Available presentation stage with padding
      const maxW = Math.max(1, (containerWidth - 32) * zoom);
      const maxH = Math.max(1, (containerHeight - 32) * zoom);

      await doc.renderPage(currentSlide, canvasRef.current, maxW, maxH);
    } catch (err: unknown) {
      const maybeError = err as { name?: string };
      if (maybeError?.name !== 'RenderingCancelledException') {
        console.error('[Glimra] Slide render error:', err);
        setRenderError('Could not render slide.');
      }
    } finally {
      setIsRendering(false);
    }
  }, [doc, currentSlide, zoom]);

  // Re-render when current slide changes or window is resized
  useEffect(() => {
    renderCurrentPage();

    const handleResize = () => {
      renderCurrentPage();
    };

    window.addEventListener('resize', handleResize);
    const observer = typeof ResizeObserver !== 'undefined' && containerRef.current
      ? new ResizeObserver(() => {
          const element = containerRef.current;
          if (element) setStageSize(previous => previous.width === element.clientWidth && previous.height === element.clientHeight
            ? previous : { width: element.clientWidth, height: element.clientHeight });
        })
      : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);
    return () => { window.removeEventListener('resize', handleResize); observer?.disconnect(); };
  }, [renderCurrentPage, stageSize.width, stageSize.height]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalSlides && onJumpToSlide) {
      onJumpToSlide(target);
    }
    setIsJumping(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        backgroundColor: 'var(--color-bg-base)',
        overflow: 'clip',
      }}
    >
      {/* Slide Rendering Stage */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flex: 1,
          width: '100%',
          position: 'relative',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Presentation slide canvas"
          style={{
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            borderRadius: 'var(--radius-sm)',
            maxWidth: zoom === 1 ? '100%' : 'none',
            maxHeight: zoom === 1 ? '100%' : 'none',
            flexShrink: 0,
            margin: 'auto',
            objectFit: 'contain',
            backgroundColor: 'var(--color-canvas-bg)',
            opacity: isBlackout ? 0 : 1,
            transition: 'opacity 0.15s ease-out',
          }}
        />

        {/* Blackout overlay */}
        {isBlackout && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--color-blackout)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>
              Screen blanked
            </span>
            <button
              onClick={onToggleBlackout}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              Resume (or press B)
            </button>
          </div>
        )}

        {isRendering && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-bg-overlay)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Rendering slide…
          </div>
        )}

        {renderError && (
          <div
            style={{
              position: 'absolute',
              padding: '12px 20px',
              backgroundColor: 'var(--color-bg-overlay)',
              border: '1px solid var(--color-signal-danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-signal-danger)',
              fontSize: '14px',
            }}
          >
            {renderError}
          </div>
        )}
      </div>

      {!isFullscreen && (
        <div aria-label="PDF zoom controls" style={{
          position: 'absolute', right: '16px', top: '12px', zIndex: 20,
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)', padding: '4px 8px',
        }}>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1}
            onClick={() => setZoom(value => Math.max(1, Math.round((value - .25) * 100) / 100))}>−</button>
          <span style={{ minWidth: '44px', textAlign: 'center', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 3}
            onClick={() => setZoom(value => Math.min(3, Math.round((value + .25) * 100) / 100))}>+</button>
          <button type="button" title="Fit the entire page" onClick={() => setZoom(1)}
            style={{ fontSize: '12px', borderLeft: '1px solid var(--color-border-subtle)', paddingLeft: '8px' }}>Fit</button>
        </div>
      )}
      {/* Floating Presenter Navigation Bar */}
      {!embedded && <nav
        aria-label="Slide navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: '16px',
          zIndex: 10,
        }}
      >
        <button
          onClick={onPrev}
          disabled={currentSlide <= 1}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated)',
            color: currentSlide <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          Previous
        </button>

        {isJumping ? (
          <form onSubmit={handleJumpSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min={1}
              max={totalSlides}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              autoFocus
              onBlur={() => setIsJumping(false)}
              style={{
                width: '44px',
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>/ {totalSlides}</span>
          </form>
        ) : (
          <button
            onClick={() => setIsJumping(true)}
            title="Click to jump to slide"
            style={{
              fontSize: '13px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-secondary)',
              minWidth: '70px',
              textAlign: 'center',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {currentSlide} / {totalSlides}
          </button>
        )}

        <button
          onClick={onNext}
          disabled={currentSlide >= totalSlides}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated)',
            color: currentSlide >= totalSlides ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
            fontSize: '13px',
          }}
        >
          Next
        </button>

        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border-subtle)' }} />

        {/* Presenter Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsTimerRunning((prev) => !prev)}
            title="Click to pause or resume presentation timer"
            style={{
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-muted)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {formatTimer(elapsedSeconds)}
          </button>
          <button
            onClick={() => setElapsedSeconds(0)}
            title="Reset timer"
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              padding: '2px 4px',
            }}
          >
            reset
          </button>
        </div>

        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-border-subtle)' }} />

        {/* Blackout button */}
        {onToggleBlackout && (
          <button
            onClick={onToggleBlackout}
            title="Press B to blackout presentation screen"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: isBlackout ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
              color: isBlackout ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontSize: '13px',
            }}
          >
            {isBlackout ? 'Resume' : 'Blank'}
          </button>
        )}

        <button
          onClick={onToggleFullscreen}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
          }}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>

        {fileName && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginLeft: '4px',
            }}
            title={fileName}
          >
            {fileName}
          </span>
        )}
      </nav>}
    </div>
  );
};
