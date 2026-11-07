import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PresentationDocument } from '../engine/pdfEngine';

interface SlideViewerProps {
  document: PresentationDocument | null;
  currentSlide: number;
  totalSlides: number;
  fileName: string | null;
  onNext: () => void;
  onPrev: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export const SlideViewer: React.FC<SlideViewerProps> = ({
  document: doc,
  currentSlide,
  totalSlides,
  fileName,
  onNext,
  onPrev,
  onToggleFullscreen,
  isFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const renderCurrentPage = useCallback(async () => {
    if (!doc || !canvasRef.current || !containerRef.current) return;

    try {
      setIsRendering(true);
      setRenderError(null);

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // Available presentation stage with padding
      const maxW = Math.max(320, containerWidth - 32);
      const maxH = Math.max(240, containerHeight - 32);

      await doc.renderPage(currentSlide, canvasRef.current, maxW, maxH);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
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
      {/* Slide Rendering Area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Presentation slide canvas"
          style={{
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'var(--color-canvas-bg)',
          }}
        />

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

      {/* Floating Presenter Navigation Bar */}
      <nav
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

        <span
          style={{
            fontSize: '13px',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-text-secondary)',
            minWidth: '70px',
            textAlign: 'center',
          }}
        >
          {currentSlide} / {totalSlides}
        </span>

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
      </nav>
    </div>
  );
};
