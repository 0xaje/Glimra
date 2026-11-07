import { useEffect, useRef } from 'react';
import { CameraOff } from 'lucide-react';

/**
 * Preview the stream owned by SmartSpectra. Never create or transfer VideoFrames
 * here: the SDK owns capture and processing, and the preview only observes it.
 */
export function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let frameCount = 0;
    let previousPresented = 0;
    let intervalStart = performance.now();
    let callbackId: number | null = null;
    let lastFrameAt = 0;

    const report = (now: number, reason: string) => {
      const elapsed = now - intervalStart;
      if (frameCount === 0 || elapsed < 250) return;
      console.info('[Glimra/Camera] preview frames', {
        previewFps: Number((frameCount * 1000 / elapsed).toFixed(1)),
        observedMs: Math.round(elapsed),
        frames: frameCount,
        reason,
        negotiatedFps: stream?.getVideoTracks()[0]?.getSettings().frameRate,
        note: 'Preview FPS is not SDK processing FPS',
      });
      frameCount = 0;
      intervalStart = now;
    };

    const onFrame: VideoFrameRequestCallback = (now, metadata) => {
      if (disposed) return;
      const presented = metadata.presentedFrames;
      // Count presented frames, including any missed between callbacks.
      frameCount += previousPresented ? Math.max(1, presented - previousPresented) : 1;
      previousPresented = presented;
      lastFrameAt = now;
      if (now - intervalStart >= 1000) report(now, 'interval');
      callbackId = video.requestVideoFrameCallback(onFrame);
    };

    if (stream) {
      video.srcObject = stream;
      // autoplay + muted + playsInline let the browser own playback.
      // Calling play() and immediately pause() during React effect cleanup
      // generated an AbortError in the previous implementation.
      if (typeof video.requestVideoFrameCallback === 'function') {
        callbackId = video.requestVideoFrameCallback(onFrame);
      } else {
        console.warn('[Glimra/Camera] preview frame callback unavailable');
      }
    } else {
      video.srcObject = null;
    }

    return () => {
      disposed = true;
      if (callbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(callbackId);
      }
      if (stream) {
        report(performance.now(), 'stream detached');
        if (!lastFrameAt) console.warn('[Glimra/Camera] preview received no frames before detach');
      }
      // Do not stop the SDK-owned MediaStream tracks from the preview.
      video.srcObject = null;
    };
  }, [stream]);

  return <div className="camera-preview">
    <video ref={videoRef} className="camera-preview-video" autoPlay muted playsInline aria-label="Live camera preview" poster="/camera-preview-poster.svg" style={{ display: stream ? 'block' : 'none' }}/>
    {!stream && <><CameraOff size={32}/><span>Camera preview appears here after you connect</span></>}
  </div>;
}
