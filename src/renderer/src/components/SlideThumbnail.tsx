import React, { useEffect, useRef, useState } from 'react';
import { PresentationDocument } from '../engine/pdfEngine';

interface SlideThumbnailProps {
  document: PresentationDocument;
  page: number;
  selected: boolean;
  onSelect: () => void;
}

export function SlideThumbnail({ document, page, selected, onSelect }: SlideThumbnailProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [document, page]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    setFailed(false);
    document.renderThumbnail(page, canvasRef.current, 104).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [document, page, visible]);

  return (
    <button
      ref={containerRef}
      type="button"
      className={`rail-slide ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      aria-label={`Go to slide ${page}`}
      aria-current={selected ? 'page' : undefined}
    >
      <span className="rail-slide-sheet">
        <canvas ref={canvasRef} className="rail-thumbnail-canvas" aria-hidden="true" />
        {!visible && <span className="rail-thumbnail-placeholder" aria-hidden="true" />}
        {failed && <span className="rail-thumbnail-error">Preview unavailable</span>}
      </span>
      <span className="rail-page-label">{page}</span>
    </button>
  );
}
