import { useEffect, useRef } from 'react';
import type { MotionCommand } from '../engine/directionalGestureEngine';

type WorkerReply =
  | { type: 'ready' }
  | { type: 'processed'; commands: MotionCommand[] }
  | { type: 'error'; message: string };

/**
 * One video camera stream; local face + hand inference runs in a Web Worker.
 * MediaPipe's synchronous detectForVideo must not block the Electron renderer,
 * because the SmartSpectra renderer bridge also extracts and sends video frames.
 *
 * Camera capture is owned by SmartSpectraController. This component NEVER
 * opens or stops camera tracks. It drops frames when its worker is busy.
 */
export function LiveGestureTracker({
  stream, enabled, onCommand, onTrackingError,
}: {
  stream: MediaStream | null;
  enabled: boolean;
  onCommand: (command: MotionCommand) => void;
  onTrackingError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const commandRef = useRef(onCommand);
  const errorRef = useRef(onTrackingError);
  const enabledRef = useRef(enabled);
  commandRef.current = onCommand;
  errorRef.current = onTrackingError;
  enabledRef.current = enabled;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    let disposed = false;
    let requestId = 0;
    let worker: Worker | null = null;
    let workerReady = false;
    let workerBusy = false;
    let lastCaptureAt = -Infinity;
    let lastVideoTime = -1;
    let previousEnabled = enabledRef.current;
    let reportedError = false;

    const reportError = (message: string) => {
      if (disposed || reportedError) return;
      reportedError = true;
      errorRef.current?.(message);
    };

    const run = async () => {
      try {
        // Keep the same host-owned MediaStream, including after SDK failure.
        video.srcObject = stream;
        await video.play();
        if (disposed) return;

        worker = new Worker(new URL('../workers/gestureWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerReply>) => {
          if (disposed) return;
          const message = event.data;
          if (message.type === 'ready') {
            workerReady = true;
            console.info('[Glimra/Gestures] Worker models ready (off renderer thread)');
          } else if (message.type === 'processed') {
            workerBusy = false;
            if (enabledRef.current) {
              for (const command of message.commands) commandRef.current(command);
            }
          } else if (message.type === 'error') {
            workerReady = false;
            workerBusy = false;
            reportError('Could not start local gesture tracking: ' + message.message);
          }
        };
        worker.onerror = (event) => {
          event.preventDefault();
          workerReady = false;
          workerBusy = false;
          reportError('Local gesture worker stopped. Check camera and model loading.');
          console.error('[Glimra/Gestures] Worker error:', event.message);
        };
        worker.postMessage({ type: 'init' });

        const frame = (timestampMs: number) => {
          if (disposed) return;
          requestId = requestAnimationFrame(frame);
          const active = enabledRef.current;
          if (active !== previousEnabled) {
            previousEnabled = active;
            worker?.postMessage({ type: 'reset' });
          }
          if (!active || !workerReady || workerBusy) return;
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
          // Max ~6 landmark frames/sec. Never queue old frames when busy.
          if (timestampMs - lastCaptureAt < 160 || video.currentTime === lastVideoTime) return;
          lastCaptureAt = timestampMs;
          lastVideoTime = video.currentTime;
          workerBusy = true;
          void createImageBitmap(video, {
            resizeWidth: 480,
            resizeHeight: 360,
            resizeQuality: 'medium',
          }).then(bitmap => {
            if (disposed || !worker || !enabledRef.current) {
              bitmap.close();
              workerBusy = false;
              return;
            }
            // Transfer ownership, never clone a large pixel buffer.
            worker.postMessage({ type: 'frame', bitmap, timestampMs }, [bitmap]);
          }).catch(error => {
            workerBusy = false;
            console.warn('[Glimra/Gestures] Frame capture failed:', error);
          });
        };
        requestId = requestAnimationFrame(frame);
      } catch (error) {
        if (!disposed) {
          console.error('[Glimra/Gestures] Initialization error:', error);
          reportError('Unable to start local camera gesture tracking.');
        }
      }
    };

    void run();
    return () => {
      disposed = true;
      cancelAnimationFrame(requestId);
      worker?.terminate();
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      aria-hidden="true"
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
    />
  );
}
