import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the worker source for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PresentationDocument {
  numPages: number;
  renderPage: (
    pageNumber: number,
    canvas: HTMLCanvasElement,
    maxWidth: number,
    maxHeight: number,
  ) => Promise<void>;
  renderThumbnail: (pageNumber: number, canvas: HTMLCanvasElement, maxWidth: number) => Promise<void>;
  destroy: () => void;
}

let activeRenderTask: pdfjsLib.RenderTask | null = null;

export async function loadPresentationFromBuffer(
  data: ArrayBuffer,
): Promise<PresentationDocument> {
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  return {
    numPages: pdfDoc.numPages,
    renderPage: async (
      pageNumber: number,
      canvas: HTMLCanvasElement,
      maxWidth: number,
      maxHeight: number,
    ) => {
      // Cancel any ongoing render task to avoid canvas tearing
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // Task already completed or cancelled
        }
        activeRenderTask = null;
      }

      const page = await pdfDoc.getPage(pageNumber);
      const unscaledViewport = page.getViewport({ scale: 1 });

      // Calculate scale to fit within maxWidth and maxHeight while preserving aspect ratio
      const scaleX = maxWidth / unscaledViewport.width;
      const scaleY = maxHeight / unscaledViewport.height;
      const fitScale = Math.min(scaleX, scaleY);

      // Support high-DPI displays (Retina/4K)
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: fitScale * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not acquire 2D canvas context');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      const task = page.render(renderContext);
      activeRenderTask = task;

      try {
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          throw err;
        }
      } finally {
        if (activeRenderTask === task) {
          activeRenderTask = null;
        }
      }
    },
    renderThumbnail: async (pageNumber, canvas, maxWidth) => {
      const page = await pdfDoc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = maxWidth / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Thumbnail canvas unavailable');
      await page.render({ canvasContext: context, viewport }).promise;
    },
    destroy: () => {
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch {
          // Clean up
        }
        activeRenderTask = null;
      }
      pdfDoc.destroy();
    },
  };
}
