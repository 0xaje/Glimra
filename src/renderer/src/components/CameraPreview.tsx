import { useEffect, useRef } from 'react';
import { CameraOff } from 'lucide-react';

export function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;

    if (stream) {
      video.play().catch((error) => {
        console.warn('[Glimra/Camera] preview playback failed', error);
      });
    }

    // Measure frames that reach the preview. This is NOT the SDK's internal
    // processing FPS, but helps distinguish capture/delivery from SDK failures.
    let cancelled = false;
    let frameCount = 0;
    let lastReportAt = 0;
    let requestId: number | undefined;
    const onFrame: VideoFrameRequestCallback = (now, metadata) => {
      if (cancelled) return;
      frameCount++;
      if (!lastReportAt) lastReportAt = now;
      const elapsed = now - lastReportAt;
      if (elapsed >= 1000) {
        const previewFps = Number((frameCount * 1000 / elapsed).toFixed(1));
        console.info('[Glimra/Camera] preview frames', {
          previewFps,
          presentedFrames: metadata.presentedFrames,
          expectedCameraFps: stream?.getVideoTracks()[0]?.getSettings().frameRate,
          note: 'Preview FPS is not SmartSpectra processing FPS',
        });
        frameCount = 0;
        lastReportAt = now;
      }
      requestId = video.requestVideoFrameCallback(onFrame);
    };

    if (stream && 'requestVideoFrameCallback' in video) {
      requestId = video.requestVideoFrameCallback(onFrame);
    } else if (stream) {
      console.warn('[Glimra/Camera] requestVideoFrameCallback unavailable; cannot measure preview FPS');
    }

    return () => {
      cancelled = true;
      if (requestId !== undefined && 'cancelVideoFrameCallback' in video) {
        video.cancelVideoFrameCallback(requestId);
      }
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  return <div className="camera-preview">
    <video ref={videoRef} className="camera-preview-video" autoPlay muted playsInline aria-label="Live camera preview" poster="/camera-preview-poster.svg" style={{ display: stream ? 'block' : 'none' }}/>
    {!stream && <><CameraOff size={32}/><span>Camera preview appears here after you connect</span></>}
  </div>;
}
