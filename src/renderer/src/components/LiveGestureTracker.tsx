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
 * The experimental MediaPipe module Worker failed inside Electron.
 * Keep the verified renderer route and load only one face or hand detector
 * selected by the presenter (head is the default), and limit its
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
    let lastFrameAdvanceAt = performance.now();
    let cameraStalled = false;
    const gestures = new DirectionalGestureEngine();

    const run = async () => {
      try {
        // Attach the original host-owned stream before loading models.
        video.srcObject = stream;
        await video.play();
        if (disposed) return;
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
        if (disposed) return;

        // Load ONE detector, not both; Head is the default.
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
            // Slightly more forgiving face acquisition for natural posture
            // and modest head turns. The gesture engine rejects tiny jitter.
            minFaceDetectionConfidence: 0.45,
            minFacePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
        }
        if (disposed) {
          // Asynchronous model loading can finish after mode switch/unmount.
          // Release that late model instead of leaking its WASM resources.
          face?.close();
          hand?.close();
          return;
        }
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
          // A live MediaStreamTrack can still stop delivering frames after
          // another consumer's SDK errors. Detect it; a model being loaded
          // does NOT mean the camera is still actively delivering images.
          const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
          const frameAdvanced = hasFrame && video.currentTime !== lastVideoTime;
          if (frameAdvanced) {
            lastVideoTime = video.currentTime;
            lastFrameAdvanceAt = now;
            if (cameraStalled) {
              cameraStalled = false;
              gestures.reset();
              console.info('[Glimra/Gestures] Camera frames resumed');
              readyRef.current?.(mode);
            }
          } else if (now - lastFrameAdvanceAt > 3500 && !cameraStalled) {
            cameraStalled = true;
            const track = stream.getVideoTracks()[0];
            console.warn('[Glimra/Gestures] Camera frames stalled', {
              trackState: track?.readyState, muted: track?.muted,
              videoReadyState: video.readyState, videoPaused: video.paused,
              videoTime: video.currentTime,
            });
            errorRef.current?.('Camera feed stalled. Head/hand tracking is waiting for live camera frames.');
          }
          if (!frameAdvanced || !enabledRef.current) return;
          // Keep the already successful natural gesture sensitivity unchanged.
          const interval = mode === 'head' ? 155 : 190;
          if (now - lastInferenceAt < interval) return;
          lastInferenceAt = now;

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
              // Restore the original working head-position control. Adapt
              // movement to the measured size of the real face, so people
              // farther from the camera need not make exaggerated turns.
              const nose = landmarks[1];
              const eyeA = landmarks[33];
              const eyeB = landmarks[263];
              const faceWidth = Math.hypot(eyeB.x - eyeA.x, eyeB.y - eyeA.y);
              // Keep the sign and direction of the previously working
              // head control exactly unchanged; only scale its threshold.
              const command = gestures.observe('head', {
                x: 1 - nose.x,
                y: nose.y,
                confidence: 1,
                faceWidth,
              }, now);
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
