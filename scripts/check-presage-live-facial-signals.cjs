#!/usr/bin/env node
'use strict';

/**
 * PRESAGE-ONLY REAL SIGNAL CHECK (not a simulated gesture demo).
 * This uses the exact native camera path that succeeded on Windows.
 * No MediaPipe, browser frame pump, second camera, or fabricated data.
 *
 * User consent: run manually in an interactive terminal. No video, faces,
 * coordinates, or physiological measurements are written to disk.
 */
const {
  SmartSpectraSDK,
  CameraSelection,
  faceMetrics,
  ProcessingStatus,
  ValidationCode,
  decodeMetrics,
} = require('@smartspectra/node-sdk');

const apiKey = (process.env.PRESAGE_API_KEY || '').trim();
if (!apiKey) {
  console.error('[Presage-only] Set PRESAGE_API_KEY in the current terminal. Do not paste it into chat.');
  process.exitCode = 2;
} else {
  void check(apiKey);
}

async function check(key) {
  let sdk = null;
  let captureCount = 0;
  let decodedCount = 0;
  let stableLandmarkCount = 0;
  let invalidLandmarkCount = 0;
  let blinkCount = 0;
  let lastBlink = false;
  let lowFpsCount = 0;
  let validCount = 0;
  let lastHint = '';
  let firstStable = null;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  let firstPointCount = null;
  let lastError = null;
  let reachedRunning = false;

  console.log('[Presage-only] Real native webcam. Close Glimra/Zoom/Camera first.');
  console.log('[Presage-only] Keep your face visible. Move your head GENTLY left/right and up/down.');
  console.log('[Presage-only] Deliberately blink a couple of times.');
  console.log('[Presage-only] Observation: up to 20s. Real SDK credits may be used.');
  try {
    sdk = new SmartSpectraSDK({
      apiKey: key,
      requestedMetrics: [...faceMetrics],
      enableAccumulatedOutput: false,
      enableTelemetry: false,
    });
    sdk.on('processingStatus', status => {
      if (status === ProcessingStatus.kRunning) reachedRunning = true;
      console.log('[Presage-only] State:', status);
    });
    sdk.on('validationStatus', (code, _timestampUs, hint) => {
      if (code === ValidationCode.kOk) validCount++;
      if (code === ValidationCode.kFrameRateTooLow) lowFpsCount++;
      if (hint) lastHint = hint;
    });
    sdk.on('metrics', (data) => {
      captureCount++;
      let decoded;
      try { decoded = decodeMetrics(data); }
      catch (error) {
        if (!lastError) lastError = 'Metric decoder error: ' + (error?.message || String(error));
        return;
      }
      if (!decoded || Buffer.isBuffer(decoded) || typeof decoded !== 'object') {
        if (!lastError) lastError = 'decodeMetrics did not return a decoded Metrics object';
        return;
      }
      decodedCount++;
      const face = decoded.face;
      for (const sample of face?.blinking ?? []) {
        if (!sample || !sample.stable) continue;
        const isBlinking = Boolean(sample.detected);
        if (isBlinking && !lastBlink) blinkCount++;
        lastBlink = isBlinking;
      }
      const landmarkSamples = face?.landmarks ?? [];
      const latest = landmarkSamples[landmarkSamples.length - 1];
      const points = latest?.value;
      if (!Array.isArray(points) || points.length < 100) {
        invalidLandmarkCount++;
        return;
      }
      if (firstPointCount === null) firstPointCount = points.length;
      if (!latest.stable || latest.reset) return;
      // The model card says 478 real facial landmarks in pixel coordinates.
      // Compute a face-wide centroid without assuming undocumented indices.
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let sumX = 0, sumY = 0, validPoints = 0;
      for (const p of points) {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        sumX += p.x; sumY += p.y; validPoints++;
      }
      if (validPoints < 100 || maxX - minX < 1 || maxY - minY < 1) {
        invalidLandmarkCount++;
        return;
      }
      stableLandmarkCount++;
      const center = { x: sumX / validPoints, y: sumY / validPoints };
      if (!firstStable) firstStable = { ...center, faceWidthPx: maxX - minX };
      const dxFaceWidths = (center.x - firstStable.x) / firstStable.faceWidthPx;
      const dyFaceWidths = (center.y - firstStable.y) / firstStable.faceWidthPx;
      xMin = Math.min(xMin, dxFaceWidths);
      xMax = Math.max(xMax, dxFaceWidths);
      yMin = Math.min(yMin, dyFaceWidths);
      yMax = Math.max(yMax, dyFaceWidths);
    });

    sdk.on('error', (code, message, retryable) => {
      if (!lastError) lastError = { code, message, retryable };
      console.error('[Presage-only] SDK error code', code, '(see result summary)');
    });
    const cameras = SmartSpectraSDK.availableCameras();
    if (cameras.length === 0) throw Error('No native camera available');
    sdk.useCamera(CameraSelection.default);
    await Promise.resolve(sdk.start());
    await new Promise(resolve => setTimeout(resolve, 20_000));
  } catch (error) {
    lastError ??= error?.message ?? String(error);
  } finally {
    try { if (sdk) await sdk.stopAsync(); }
    catch (error) { console.warn('[Presage-only] Stop warning:', error?.message); }
    try { if (sdk) await sdk.destroy(); }
    catch (error) { console.warn('[Presage-only] Destroy warning:', error?.message); }

    const report = {
      source: 'Presage SmartSpectra native SDK (no MediaPipe)',
      reachedRunning,
      metricsPackets: captureCount,
      decodedMetricsPackets: decodedCount,
      stableLandmarkSamples: stableLandmarkCount,
      landmarkPointCount: firstPointCount,
      malformedOrMissingLandmarkSamples: invalidLandmarkCount,
      detectedBlinkStarts: blinkCount,
      validSdkChecks: validCount,
      lowFpsWarnings: lowFpsCount,
      faceCenterMovementRangeInFaceWidths: firstStable && stableLandmarkCount > 1
        ? { horizontal: +(xMax - xMin).toFixed(3), vertical: +(yMax - yMin).toFixed(3) }
        : null,
      error: lastError,
    };
    console.log('\n[PRESAGE-SDK-ONLY] RESULT', JSON.stringify(report, null, 2));
    if (!reachedRunning || stableLandmarkCount < 2 || lastError) process.exitCode = 1;
    else console.log('[Presage-only] Genuine SDK facial-landmark stream verified; gesture UX is NOT yet validated.');
  }
}
