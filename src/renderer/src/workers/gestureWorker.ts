import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { DirectionalGestureEngine, type MotionCommand } from '../engine/directionalGestureEngine';

// MediaPipe inference is synchronous. Keep it OFF the Electron renderer thread,
// where SmartSpectra must pump 25+ camera frames per second.
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

type Input =
  | { type: 'init' }
  | { type: 'frame'; bitmap: ImageBitmap; timestampMs: number }
  | { type: 'reset' };
type Output =
  | { type: 'ready' }
  | { type: 'processed'; commands: MotionCommand[] }
  | { type: 'error'; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Input>) => void) | null;
  postMessage: (message: Output) => void;
};

let face: FaceLandmarker | null = null;
let hand: HandLandmarker | null = null;
let ready = false;
let loading = false;
let useHandNext = false;
let lastFaceAt = -Infinity;
let lastHandAt = -Infinity;
let lastTimestamp = -Infinity;
const gestures = new DirectionalGestureEngine();

async function initialize(): Promise<void> {
  if (ready || loading) return;
  loading = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    face = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
      numFaces: 1,
      runningMode: 'VIDEO',
    });
    hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'CPU' },
      numHands: 1,
      runningMode: 'VIDEO',
    });
    ready = true;
    scope.postMessage({ type: 'ready' });
  } catch (error) {
    // Close partial initialization on failure.
    face?.close();
    hand?.close();
    face = null;
    hand = null;
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unable to load gesture models',
    });
  } finally {
    loading = false;
  }
}

function processFrame(bitmap: ImageBitmap, timestampMs: number): void {
  const commands: MotionCommand[] = [];
  try {
    if (!ready || !face || !hand || !Number.isFinite(timestampMs)) return;
    const timestamp = Math.max(timestampMs, lastTimestamp + 1);
    lastTimestamp = timestamp;
    // Alternate face and hand models to avoid consecutive CPU bursts.
    // This worker processes only one transferred frame at a time.
    if (!useHandNext || timestamp - lastHandAt < 220) {
      lastFaceAt = timestamp;
      const landmarks = face.detectForVideo(bitmap, timestamp).faceLandmarks[0];
      if (!landmarks) {
        gestures.observe('head', null, timestamp);
      } else {
        const nose = landmarks[1];
        const command = gestures.observe('head', { x: 1 - nose.x, y: nose.y, confidence: 1 }, timestamp);
        if (command) commands.push(command);
      }
      useHandNext = true;
    } else {
      lastHandAt = timestamp;
      const palm = hand.detectForVideo(bitmap, timestamp).landmarks[0];
      if (!palm) {
        gestures.observe('hand', null, timestamp);
      } else {
        const wrist = palm[0];
        const extended = [8, 12, 16, 20].filter((tip, index) => {
          const joint = palm[[5, 9, 13, 17][index]];
          return Math.hypot(palm[tip].x - wrist.x, palm[tip].y - wrist.y) >
            Math.hypot(joint.x - wrist.x, joint.y - wrist.y) * 1.15;
        }).length;
        if (extended < 3) {
          gestures.observe('hand', null, timestamp);
        } else {
          const indices = [0, 5, 9, 13, 17];
          const x = indices.reduce((sum, index) => sum + palm[index].x, 0) / indices.length;
          const y = indices.reduce((sum, index) => sum + palm[index].y, 0) / indices.length;
          const command = gestures.observe('hand', { x: 1 - x, y, confidence: 1 }, timestamp);
          if (command) commands.push(command);
        }
      }
      useHandNext = false;
    }
  } catch (error) {
    // One malformed frame is not reason to disable a live camera.
    console.warn('[Glimra/GestureWorker] Skipped frame', error);
  } finally {
    // Transferred ImageBitmaps MUST be released in the owning worker.
    bitmap.close();
    scope.postMessage({ type: 'processed', commands });
  }
}

scope.onmessage = (event: MessageEvent<Input>) => {
  const data = event.data;
  if (data.type === 'init') {
    void initialize();
  } else if (data.type === 'reset') {
    gestures.reset();
  } else if (data.type === 'frame') {
    processFrame(data.bitmap, data.timestampMs);
  }
};
