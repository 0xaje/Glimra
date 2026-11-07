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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Presenter Elapsed Session Timer
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

      // Generous presentation canvas margins for studio layout
      const maxW = Math.max(320, containerWidth - 48);
      const maxH = Math.max(240, containerHeight - 64);

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
  }, [doc, currentSlide]);

  // Re-render when current slide changes or window is resized
  useEffect(() => {
    renderCurrentPage();

    const handleResize = () => {
      renderCurrentPage();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCurrentPage]);

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
        backgroundColor: 'var(--studio-bg)',
        overflow: 'clip',
      }}
    >
      {/* Slide Presentation Canvas Stage */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          position: 'relative',
          padding: '24px 24px 12px 24px',
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Presentation slide canvas"
          style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'var(--studio-canvas-bg)',
            opacity: isBlackout ? 0 : 1,
            transition: 'opacity 120ms ease-out',
            border: '1px solid var(--studio-rule-light)',
          }}
        />

        {/* Blackout Stage Overlay */}
        {isBlackout && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--studio-blackout)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              gap: '16px',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--studio-ink-secondary)' }}>
              Screen Blanked
            </span>
            <span style={{ fontSize: '12px', color: 'var(--studio-ink-muted)' }}>
              Audience view temporarily suspended for speaker focus
            </span>
            <button
              onClick={onToggleBlackout}
              style={{
                fontSize: '13px',
                padding: '8px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--studio-amber)',
                color: 'var(--studio-amber-ink)',
                fontWeight: 600,
              }}
            >
              Resume presentation (B)
            </button>
          </div>
        )}

        {/* Rendering Slide Notification */}
        {isRendering && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--studio-overlay)',
              border: '1px solid var(--studio-rule)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--studio-ink-secondary)',
            }}
          >
            Rendering slide…
          </div>
        )}

        {/* Error Notification */}
        {renderError && (
          <div
            style={{
              position: 'absolute',
              padding: '12px 20px',
              backgroundColor: 'var(--studio-overlay)',
              border: '1px solid var(--studio-signal-alert)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--studio-signal-alert)',
              fontSize: '13px',
            }}
          >
            {renderError}
          </div>
        )}
      </div>

      {/* Floating Presenter Studio Control Dock */}
      <nav
        aria-label="Presenter control dock"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-rule-light)',
          marginBottom: '16px',
          zIndex: 10,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Previous Slide Button */}
        <button
          onClick={onPrev}
          disabled={currentSlide <= 1}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--studio-rule)',
            backgroundColor: 'var(--studio-elevated)',
            color: currentSlide <= 1 ? 'var(--studio-ink-dim)' : 'var(--studio-ink-primary)',
            fontSize: '13px',
            fontWeight: 500,
          }}
          title="Previous slide (Left Arrow or Page Up)"
        >
          Previous
        </button>

        {/* Slide Counter / Jump Form */}
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
                width: '48px',
                padding: '3px 4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--studio-amber)',
                backgroundColor: 'var(--studio-bg)',
                color: 'var(--studio-ink-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--studio-ink-muted)' }}>
              / {String(totalSlides).padStart(2, '0')}
            </span>
          </form>
        ) : (
          <button
            onClick={() => setIsJumping(true)}
            title="Click to jump to specific slide"
            style={{
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--studio-ink-primary)',
              minWidth: '76px',
              textAlign: 'center',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--studio-rule)',
              backgroundColor: 'var(--studio-subtle)',
            }}
          >
            {String(currentSlide).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </button>
        )}

        {/* Next Slide Button */}
        <button
          onClick={onNext}
          disabled={currentSlide >= totalSlides}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--studio-rule)',
            backgroundColor: 'var(--studio-elevated)',
            color: currentSlide >= totalSlides ? 'var(--studio-ink-dim)' : 'var(--studio-ink-primary)',
            fontSize: '13px',
            fontWeight: 500,
          }}
          title="Next slide (Right Arrow or Page Down)"
        >
          Next
        </button>

        <span style={{ width: '1px', height: '18px', backgroundColor: 'var(--studio-rule)' }} />

        {/* Presenter Session Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsTimerRunning((prev) => !prev)}
            title="Click to pause or resume timer"
            style={{
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--font-mono)',
              color: isTimerRunning ? 'var(--studio-amber)' : 'var(--studio-ink-muted)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--studio-rule)',
              backgroundColor: 'var(--studio-elevated)',
            }}
          >
            {formatTimer(elapsedSeconds)}
          </button>
          <button
            onClick={() => setElapsedSeconds(0)}
            title="Reset session timer"
            style={{
              fontSize: '11px',
              color: 'var(--studio-ink-muted)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            reset
          </button>
        </div>

        <span style={{ width: '1px', height: '18px', backgroundColor: 'var(--studio-rule)' }} />

        {/* Blackout Toggle Button */}
        {onToggleBlackout && (
          <button
            onClick={onToggleBlackout}
            title="Press B to blank out screen"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: isBlackout ? '1px solid var(--studio-amber)' : '1px solid var(--studio-rule)',
              backgroundColor: isBlackout ? 'var(--studio-amber-subtle)' : 'var(--studio-elevated)',
              color: isBlackout ? 'var(--studio-amber)' : 'var(--studio-ink-secondary)',
              fontSize: '13px',
            }}
          >
            {isBlackout ? 'Resume' : 'Blank (B)'}
          </button>
        )}

        {/* Fullscreen Toggle Button */}
        <button
          onClick={onToggleFullscreen}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--studio-rule)',
            backgroundColor: 'var(--studio-elevated)',
            color: 'var(--studio-ink-secondary)',
            fontSize: '13px',
          }}
          title="Toggle fullscreen presentation (F)"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
        </button>

        {/* Loaded Document Name */}
        {fileName && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--studio-ink-muted)',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginLeft: '4px',
              fontFamily: 'var(--font-mono)',
            }}
            title={fileName}
          >
            {fileName}
          </span>
        )}
      </nav>
    </div>
  );
};
