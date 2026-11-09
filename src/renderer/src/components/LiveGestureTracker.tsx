import { useEffect, useRef } from 'react';
import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { MotionCommand } from '../engine/directionalGestureEngine';
import { DirectionalGestureEngine } from '../engine/directionalGestureEngine';

export type GestureControlMode = 'hand' | 'head' | 'eyes';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Real camera landmark detector.
 *
 * The first attempt at moving MediaPipe into a module Worker failed in
 * Electron ("ModuleFactory not set"), leaving ALL gesture controls broken.
 * Use the previously working renderer route instead. Load only the one
 * detector selected by the presenter (hands by default), and limit its
 * frame rate to reduce SmartSpectra contention.
 *
 * Camera ownership remains in SmartSpectraController. This component
 * neither requests a second webcam nor stops camera tracks.
 */
export function LiveGestureTracker({
  stream, enabled, mode, onCommand, onTrackingError, onTrackingReady,
}: {
  stream: MediaStream | null;
  enabled: boolean;
  mode: GestureControlMode;
  onCommand: (command: MotionCommand) => void;
  onTrackingError?: (message: string) => void;
  onTrackingReady?: (mode: GestureControlMode) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const commandRef = useRef(onCommand);
  const errorRef = useRef(onTrackingError);
  const readyRef = useRef(onTrackingReady);
  const enabledRef = useRef(enabled);
  commandRef.current = onCommand;
  errorRef.current = onTrackingError;
  readyRef.current = onTrackingReady;
  enabledRef.current = enabled;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || mode === 'eyes') return;
    let disposed = false;
    let frameId = 0;
    let face: FaceLandmarker | null = null;
    let hand: HandLandmarker | null = null;
    let lastInferenceAt = -Infinity;
    let lastVideoTime = -1;
    const gestures = new DirectionalGestureEngine();

    const run = async () => {
      try {
        // Attach the original host-owned stream before loading models.
        video.srcObject = stream;
        await video.play();
        if (disposed) return;
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        if (disposed) return;

        // Load ONE detector, not both. Default hand mode does no face inference.
        if (mode === 'hand') {
          hand = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          });
        } else {
          face = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
          });
        }
        if (disposed) return;
        console.info('[Glimra/Gestures] Real ' + mode + ' tracking ready');
        readyRef.current?.(mode);

        const frame = (now: number) => {
          if (disposed) return;
          frameId = requestAnimationFrame(frame);
          if (!enabledRef.current) {
            gestures.setPaused(true);
            return;
          }
          gestures.setPaused(false);
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return;
          // ~5 checks/sec, no sample queues and NO inactivity expiry.
          if (now - lastInferenceAt < 190 || video.currentTime === lastVideoTime) return;
          lastInferenceAt = now;
          lastVideoTime = video.currentTime;

          try {
            if (mode === 'hand') {
              const landmarks = hand!.detectForVideo(video, now).landmarks[0];
              if (!landmarks) {
                gestures.observe('hand', null, now);
                return;
              }
              const wrist = landmarks[0];
              const tips = [8, 12, 16, 20];
              const joints = [5, 9, 13, 17];
              const extended = tips.filter((tip, index) => {
                const t = landmarks[tip];
                const j = landmarks[joints[index]];
                return Math.hypot(t.x - wrist.x, t.y - wrist.y) >
                  Math.hypot(j.x - wrist.x, j.y - wrist.y) * 1.12;
              }).length;
              if (extended < 3) {
                gestures.observe('hand', null, now);
                return;
              }
              const palmIndices = [0, 5, 9, 13, 17];
              const x = palmIndices.reduce((sum, i) => sum + landmarks[i].x, 0) / palmIndices.length;
              const y = palmIndices.reduce((sum, i) => sum + landmarks[i].y, 0) / palmIndices.length;
              const command = gestures.observe('hand', { x: 1 - x, y, confidence: 1 }, now);
              if (command) commandRef.current(command);
            } else {
              const landmarks = face!.detectForVideo(video, now).faceLandmarks[0];
              if (!landmarks) {
                gestures.observe('head', null, now);
                return;
              }
              const nose = landmarks[1];
              const command = gestures.observe('head', { x: 1 - nose.x, y: nose.y, confidence: 1 }, now);
              if (command) commandRef.current(command);
            }
          } catch (error) {
            console.warn('[Glimra/Gestures] Frame skipped:', error);
          }
        };
        frameId = requestAnimationFrame(frame);
      } catch (error) {
        if (!disposed) {
          console.error('[Glimra/Gestures] Tracking setup failed:', error);
          errorRef.current?.('Could not load ' + mode + ' tracking. Check your connection and camera.');
        }
      }
    };

    void run();
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      video.pause();
      video.srcObject = null;
      // Close detectors even if mode changed during asynchronous initialization.
      face?.close();
      hand?.close();
    };
  }, [stream, mode]);

  return (
    <video ref={videoRef} muted playsInline aria-hidden="true"
      style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}/>
  );
}
