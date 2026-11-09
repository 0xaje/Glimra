'use strict';

/**
 * Only genuine @smartspectra/node-sdk measurements can issue a command.
 * Runs as a Node child process of Electron (ELECTRON_RUN_AS_NODE=1):
 * native SDK owns camera and gets full native video cadence, not renderer
 * MediaStreamTrackProcessor/IPC pixels. No MediaPipe / simulated readings.
 */
const {
  SmartSpectraSDK,
  CameraSelection,
  faceMetrics,
  decodeMetrics,
  ProcessingStatus,
  ValidationCode,
} = require('@smartspectra/node-sdk');
const { PresageHeadMotion } = require('./presageHeadMotion.cjs');

let sdk = null;
let active = false;
let starting = false;
let closing = false;
let mode = 'head';
let paused = false;
let calibrating = false;
let blinkTiming = { min: 400, max: 1800, cooldown: 800 };
let sdkRunning = false;
let lastValid = 0;
let faceTracked = false;
let lastValidationCode = null;
let lastValidationReportAt = 0;
let noFaceSince = null;
let multipleFaces = false;
let lastLandmarkTimestamp = 0;
let lastBlinkTimestamp = 0;
let blinkStartedAt = null;
let lastQuickBlinkAt = -Infinity;
let lastBlinkDetected = false;
let lastCommandAt = -Infinity;
let headCount = 0;
const head = new PresageHeadMotion();
const setFaceTracked = (tracked, reason) => {
  if (faceTracked === tracked) return;
  faceTracked = tracked;
  if (!tracked) {
    head.reset();
    blinkStartedAt = null;
    lastBlinkDetected = false;
    lastQuickBlinkAt = -Infinity;
  }
  emit('face-status', {
    tracked,
    reason: tracked ? 'Presage facial landmarks detected'
      : String(reason ?? 'Waiting for a face').slice(0, 140),
  });
};

// A native SDK session may stay in kRunning while face landmarks pause.
// Do not leave "Head ready" on-screen when actual valid frames stop.
const faceWatchdog = setInterval(() => {
  if (active && sdkRunning && faceTracked && Date.now() - lastValid > 1800) {
    setFaceTracked(false, 'Presage lost stable face tracking. Move into the camera view.');
  }
}, 550);
faceWatchdog.unref?.();

const emit = (type, payload = {}) => {
  if (typeof process.send === 'function' && process.connected) {
    process.send({ type, ...payload });
  }
};

function processBlink(samples) {
  if (!Array.isArray(samples) || mode !== 'eyes' || paused) return;
  for (const sample of samples) {
    if (!sample || sample.stable !== true) {
      blinkStartedAt = null;
      lastBlinkDetected = false;
      continue;
    }
    const ts = Number(sample.timestamp);
    if (!Number.isFinite(ts) || ts <= lastBlinkTimestamp) continue;
    lastBlinkTimestamp = ts;
    const detected = sample.detected === true;
    if (detected && !lastBlinkDetected) blinkStartedAt = ts;
    else if (!detected && lastBlinkDetected && blinkStartedAt !== null) {
      const heldMs = (ts - blinkStartedAt) / 1000;
      blinkStartedAt = null;
      const now = Date.now();
      if (calibrating) {
        if (heldMs >= 250 && heldMs <= 2500) emit('calibration', { durationMs: Math.round(heldMs) });
        // Update the real detection edge even during practice. Otherwise a
        // completed eye opening leaves the engine stuck in the closed state.
        lastBlinkDetected = detected;
        continue;
      }
      // Explicit long intentional blink advances, normal quick blinks do not.
      if (heldMs >= blinkTiming.min && heldMs <= blinkTiming.max && now - lastCommandAt >= blinkTiming.cooldown) {
        lastCommandAt = now;
        emit('gesture', { direction: 'right', source: 'blink', label: 'Long blink' });
        lastQuickBlinkAt = -Infinity;
      } else if (heldMs >= 70 && heldMs < 350) {
        // Two distinct short blinks within 650ms = previous slide.
        if (now - lastQuickBlinkAt >= 130 && now - lastQuickBlinkAt <= 650 && now - lastCommandAt >= blinkTiming.cooldown) {
          lastCommandAt = now;
          emit('gesture', { direction: 'left', source: 'blink', label: 'Double blink' });
          lastQuickBlinkAt = -Infinity;
        } else lastQuickBlinkAt = now;
      }
    }
    lastBlinkDetected = detected;
  }
}

function onMetrics(buffer) {
  if (!active || paused || !sdkRunning || multipleFaces) return;
  let decoded;
  try { decoded = decodeMetrics(buffer); }
  catch (e) {
    emit('warning', { message: 'Presage metrics could not be decoded: ' + (e?.message ?? 'unknown') });
    return;
  }
  if (!decoded || Buffer.isBuffer(decoded) || typeof decoded !== 'object') return;
  const now = Date.now();
  const samples = decoded.face?.landmarks;
  const latest = Array.isArray(samples) ? samples[samples.length - 1] : null;
  if (latest && latest.stable === true && latest.reset !== true) {
    const ts = Number(latest.timestamp);
    if (Number.isFinite(ts) && ts > lastLandmarkTimestamp) {
      lastLandmarkTimestamp = ts;
      lastValid = now;
      setFaceTracked(true);
      headCount++;
      if (mode === 'head') {
        const direction = head.observe(latest, now);
        if (direction) emit('gesture', { source: 'head', direction, label: 'Head ' + direction });
      }
      // Statistics only: do not transmit raw face landmarks.
      if (headCount === 1 || headCount % 150 === 0) {
        emit('signal', {
          validLandmarkSamples: headCount,
        });
      }
    }
  } else if (latest?.reset) {
    setFaceTracked(false, 'Presage restarted face tracking; acquiring a new neutral position.');
    head.reset();
  }
  processBlink(decoded.face?.blinking);
}

async function stop() {
  if (closing) return;
  closing = true;
  active = false;
  sdkRunning = false;
  faceTracked = false;
  try {
    if (sdk?.stopAsync) await sdk.stopAsync();
    else if (sdk?.stop) await sdk.stop();
  } catch (error) {
    emit('warning', { message: 'Presage shutdown: ' + (error?.message ?? String(error)) });
  } finally {
    try { if (sdk?.destroy) await sdk.destroy(); }
    catch (_) { /* Native SDK already stopped; do not retain it. */ }
    sdk = null;
    emit('stopped');
    // Clean process exit releases native camera even after an SDK fault.
    process.exit(0);
  }
}

async function start(key, requestedMode) {
  if (starting || active || closing) return;
  if (typeof key !== 'string' || !key.trim()) {
    emit('error', { code: 'missing-key', message: 'SmartSpectra API key required' });
    return;
  }
  starting = true;
  mode = requestedMode === 'eyes' ? 'eyes' : 'head';
  try {
    sdk = new SmartSpectraSDK({
      apiKey: key.trim(),
      requestedMetrics: [...faceMetrics],
      enableAccumulatedOutput: false,
      enableTelemetry: false,
    });
    sdk.on('processingStatus', status => {
      if (closing) return;
      sdkRunning = status === ProcessingStatus.kRunning;
      if (status === ProcessingStatus.kRunning) {
        active = true;
        emit('state', { state: 'tracking', source: 'Presage SmartSpectra native' });
      } else if (status === ProcessingStatus.kStarting) {
        emit('state', { state: 'initializing' });
      } else if (status === ProcessingStatus.kError) {
        emit('state', { state: 'error' });
      }
    });
    sdk.on('validationStatus', (code, _ts, hint) => {
      if (closing) return;
      if (code === ValidationCode.kMultipleFacesFound) {
        multipleFaces = true;
        noFaceSince = null;
        setFaceTracked(false, 'More than one face detected. Show one presenter at a time.');
      } else if (code === ValidationCode.kNoFaceFound) {
        multipleFaces = false;
        if (noFaceSince === null) noFaceSince = Date.now();
        // Avoid a full reset for one dropped SDK detection frame.
        if (Date.now() - noFaceSince >= 320) {
          setFaceTracked(false, 'No face detected. Step into the camera view.');
        }
      } else {
        multipleFaces = false;
        noFaceSince = null;
      }
      // Throttle per-frame quality warnings to avoid flooding Electron IPC
      // and React rendering. Do not treat illumination hints as SDK errors.
      if (code === ValidationCode.kOk) {
        lastValidationCode = null;
        return;
      }
      const now = Date.now();
      if (code !== lastValidationCode || now - lastValidationReportAt >= 4000) {
        lastValidationCode = code;
        lastValidationReportAt = now;
        emit('validation', {
          code: Number(code),
          hint: typeof hint === 'string' ? hint.slice(0, 160) : '',
        });
      }
    });
    sdk.on('metrics', onMetrics);
    sdk.on('error', (code, message, retryable) => {
      emit('error', {
        code: Number(code),
        message: String(message ?? 'Presage processing stopped').slice(0, 200),
        retryable: Boolean(retryable),
      });
      void stop();
    });
    if (SmartSpectraSDK.availableCameras().length < 1) {
      throw new Error('No Windows camera detected by the native Presage SDK');
    }
    sdk.useCamera(CameraSelection.default);
    await Promise.resolve(sdk.start());
    // SDK 'processingStatus' kRunning is the source of tracking readiness.
  } catch (error) {
    emit('error', { code: 'start', message: String(error?.message ?? error).slice(0, 200) });
    void stop();
  } finally {
    starting = false;
  }
}

process.on('message', (message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'start') void start(message.key, message.mode);
  else if (message.type === 'mode') {
    mode = message.mode === 'eyes' ? 'eyes' : 'head';
    head.reset();
    blinkStartedAt = null;
    lastBlinkDetected = false;
    lastQuickBlinkAt = -Infinity;
    emit('mode', { mode });
  } else if (message.type === 'timing') {
    const min = Number(message.min), max = Number(message.max), cooldown = Number(message.cooldown);
    if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(cooldown) &&
        min >= 300 && min <= 1200 && max >= min + 100 && max <= 2500 &&
        cooldown >= 500 && cooldown <= 3000) {
      blinkTiming = { min, max, cooldown };
      blinkStartedAt = null;
      lastBlinkDetected = false;
    }
  } else if (message.type === 'recenter') {
    head.reset();
    blinkStartedAt = null;
    setFaceTracked(false, 'Recenter requested. Face will set a new neutral position.');
    emit('recentered', { reason: 'manual' });
  } else if (message.type === 'calibration') {
    calibrating = message.enabled === true;
    blinkStartedAt = null;
    lastBlinkDetected = false;
  } else if (message.type === 'pause') {
    paused = Boolean(message.paused);
    head.reset();
    blinkStartedAt = null;
    lastBlinkDetected = false;
  } else if (message.type === 'stop') void stop();
});

// If Electron closes unexpectedly, do not keep the camera running.
process.on('disconnect', () => { void stop(); });
process.on('uncaughtException', error => {
  emit('error', { code: 'native-process', message: String(error?.message ?? error).slice(0, 200) });
  void stop();
});
