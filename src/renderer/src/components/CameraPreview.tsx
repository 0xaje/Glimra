import { useEffect, useRef } from 'react';
import { CameraOff } from 'lucide-react';

export function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      video.play().catch(() => { /* Browser may require user interaction. */ });
    }
    return () => { video.srcObject = null; };
  }, [stream]);
  return <div className="camera-preview">
    <video ref={videoRef} className="camera-preview-video" autoPlay muted playsInline aria-label="Live camera preview" style={{ display: stream ? 'block' : 'none' }}/>
    {!stream && <><CameraOff size={32}/><span>Camera preview appears here after you connect</span></>}
  </div>;
}
