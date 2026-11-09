import { useEffect, useRef } from 'react';
import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { DirectionalGestureEngine, MotionCommand } from '../engine/directionalGestureEngine';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Runs local face/hand landmark inference on the already-consented camera.
 * Model assets download on first use; frames are processed in the renderer.
 * No session idle timeout, fake points, or extra getUserMedia request.
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
    let raf = 0;
    let face: FaceLandmarker | null = null;
    let hand: HandLandmarker | null = null;
    let lastVideoTime = -1;
    let lastInferenceAt = 0;
    let lastFaceInferenceAt = 0;
    let lastHandInferenceAt = 0;
    const engine = new DirectionalGestureEngine();

    const run = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        if (disposed) return;
        face = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (disposed) return;
        hand = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (disposed) return;
        video.srcObject = stream;
        await video.play();
        if (disposed) return;

        const frame = (now: number) => {
          if (disposed) return;
          raf = requestAnimationFrame(frame);
          if (!enabledRef.current) { engine.setPaused(true); return; }
          engine.setPaused(false);
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
          // Limit inference cost while preserving an always-on session.
          if (now - lastInferenceAt < 120 || video.currentTime === lastVideoTime) return;
          lastInferenceAt = now;
          lastVideoTime = video.currentTime;
          try {
            // Avoid running two expensive CPU models on every video frame.
            // Each model runs at most about 4 Hz; SmartSpectra keeps the
            // original camera frame rate independently.
            if (now - lastFaceInferenceAt >= 240) {
              lastFaceInferenceAt = now;
              const faceResult = face!.detectForVideo(video, now);
              const landmarks = faceResult.faceLandmarks[0];
              if (landmarks) {
              // Nose position is in original camera coordinates, not mirrored UI.
              const nose = landmarks[1];
              const command = engine.observe('head', { x: 1 - nose.x, y: nose.y, confidence: 1 }, now);
              if (command) commandRef.current(command);
              } else {
                engine.observe('head', null, now);
              }
            }
            if (now - lastHandInferenceAt < 240) return;
            lastHandInferenceAt = now;
            const handResult = hand!.detectForVideo(video, now);
            const palm = handResult.landmarks[0];
            if (palm) {
              // Palm center is less noisy than individual fingertips.
              const ids = [0, 5, 9, 13, 17];
              const x = ids.reduce((sum, i) => sum + palm[i].x, 0) / ids.length;
              const y = ids.reduce((sum, i) => sum + palm[i].y, 0) / ids.length;
              // Require an open hand: fingers extended away from wrist.
              const wrist = palm[0];
              const tips = [8, 12, 16, 20];
              const joints = [5, 9, 13, 17];
              const extended = tips.filter((tip, i) => {
                const t = palm[tip], j = palm[joints[i]];
                return Math.hypot(t.x - wrist.x, t.y - wrist.y) >
                  Math.hypot(j.x - wrist.x, j.y - wrist.y) * 1.15;
              }).length;
              const command = engine.observe('hand', extended >= 3 ? { x: 1 - x, y, confidence: 1 } : null, now);
              if (command) commandRef.current(command);
            } else {
              engine.observe('hand', null, now);
            }
          } catch (error) {
            // Do not kill the camera on one malformed frame.
            console.warn('[Glimra/Gestures] Frame inference skipped', error);
          }
        };
        raf = requestAnimationFrame(frame);
      } catch (error) {
        if (!disposed) {
          console.error('[Glimra/Gestures] Could not load local gesture models', error);
          errorRef.current?.('Gesture tracking could not start. Check your internet connection for the first model download.');
        }
      }
    };
    void run();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      video.pause();
      video.srcObject = null;
      face?.close();
      hand?.close();
    };
  }, [stream]);

  return <video ref={videoRef} muted playsInline aria-hidden="true"
    style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}/>;
}
