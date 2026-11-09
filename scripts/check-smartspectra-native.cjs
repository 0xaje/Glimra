#!/usr/bin/env node
'use strict';

/**
 * Independent real-hardware check of the published Presage Node SDK.
 * No Electron renderer, no MediaPipe, no virtual/simulated measurements.
 * Does not save frames, the key, or physiological data to disk.
 * Close Glimra and every other app using the webcam before running.
 */
const { SmartSpectraSDK, CameraSelection, faceMetrics, ProcessingStatus, ValidationCode } =
  require('@smartspectra/node-sdk');

const key = (process.env.PRESAGE_API_KEY || '').trim();
if (!key) {
  console.error('Missing PRESAGE_API_KEY. Set it in this PowerShell session; do not share it or commit it.');
  console.error("Example: $env:PRESAGE_API_KEY = Read-Host 'SmartSpectra API key'");
  process.exitCode = 2;
} else {
  void main(key);
}

async function main(apiKey) {
  let sdk;
  let successes = 0;
  let totalMetrics = 0;
  let fpsWarnings = 0;
  let validationOk = 0;
  let failure = null;
  let runningObserved = false;

  try {
    console.log('[SDK-only] Checking real Windows webcam. Glimra and MediaPipe are NOT running here.');
    console.log('[SDK-only] 20-second observation. It can use real SmartSpectra measurement credits.');
    console.log('[SDK-only] Camera data is not saved by this script.');

    sdk = new SmartSpectraSDK({
      apiKey,
      requestedMetrics: [...faceMetrics],
      enableAccumulatedOutput: false,
    });

    sdk.on('processingStatus', status => {
      if (status === ProcessingStatus.kRunning) runningObserved = true;
      console.log('[SDK-only] Processing state:', status);
    });
    sdk.on('validationStatus', (code, timestampUs, hint) => {
      if (code === ValidationCode.kOk) validationOk++;
      if (code === ValidationCode.kFrameRateTooLow) fpsWarnings++;
      // Show changed warnings, not one log line per frame.
      if (code !== 0 && (fpsWarnings === 1 || fpsWarnings % 50 === 0)) {
        console.log('[SDK-only] Validation:', code, hint);
      }
    });
    sdk.on('metrics', () => { totalMetrics++; });
    sdk.on('error', (code, message, retryable) => {
      if (!failure) failure = { code, message, retryable };
      console.error('[SDK-only] SDK error', code, message, '(retryable:', retryable, ')');
    });

    const cameras = SmartSpectraSDK.availableCameras();
    console.log('[SDK-only] Native webcams found:', cameras.length);
    if (!cameras.length) throw new Error('No native camera detected. Close other camera applications and check Windows camera permissions.');
    sdk.useCamera(CameraSelection.default);
    await sdk.start();

    // Measure for 20 seconds, but never auto-retry or consume a second session.
    await new Promise(resolve => setTimeout(resolve, 20_000));
    successes++;
  } catch (err) {
    failure ??= { code: err?.code ?? 'start', message: err?.message ?? String(err), retryable: err?.retryable ?? false };
    console.error('[SDK-only] Test failed:', failure.message);
  } finally {
    try {
      if (typeof sdk?.stopAsync === 'function') await sdk.stopAsync();
      else if (typeof sdk?.stop === 'function') await sdk.stop();
    } catch (err) {
      console.warn('[SDK-only] Stop warning:', err?.message ?? err);
    }
    try { if (sdk && typeof sdk.destroy === 'function') await sdk.destroy(); }
    catch (err) { console.warn('[SDK-only] Destroy warning:', err?.message ?? err); }

    console.log('\n[SDK-only] RESULT', JSON.stringify({
      independentNativeCameraTest: true,
      reachedRunningState: runningObserved,
      deliveredMetricsCallbacks: totalMetrics,
      validationsOk: validationOk,
      frameRateTooLowWarnings: fpsWarnings,
      error: failure,
    }, null, 2));
    if (failure || !runningObserved || totalMetrics === 0) {
      console.log('[SDK-only] No confirmed successful metrics. This test has NO MediaPipe or Electron renderer load.');
      process.exitCode = 1;
    } else {
      console.log('[SDK-only] Real SDK metrics were delivered without MediaPipe; investigate Electron renderer capture contention.');
    }
  }
}
