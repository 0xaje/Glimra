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

export async function loadPresentationFromBuffer(
  data: ArrayBuffer,
): Promise<PresentationDocument> {
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  // PDF.js cannot render two pages into the same canvas at once.
  // Serialize main-stage renders and skip outdated requests.
  let renderQueue: Promise<void> = Promise.resolve();
  let latestRequest = 0;
  let disposed = false;

  return {
    numPages: pdfDoc.numPages,
    renderPage: (pageNumber, canvas, maxWidth, maxHeight) => {
      const request = ++latestRequest;
      const render = async () => {
        if (disposed || request !== latestRequest) return;
        const page = await pdfDoc.getPage(pageNumber);
        if (disposed || request !== latestRequest) return;
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(maxWidth / unscaled.width, maxHeight / unscaled.height);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * dpr });
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not acquire 2D canvas context');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        await page.render({ canvasContext: ctx, viewport }).promise;
      };
      const result = renderQueue.then(render);
      // Keep the queue alive after an error, but report that error to the caller.
      renderQueue = result.catch(() => {});
      return result;
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
      disposed = true;
      latestRequest++;
      // Let an in-flight render settle before releasing the PDF document.
      void renderQueue.finally(() => pdfDoc.destroy());
    },
  };
}
