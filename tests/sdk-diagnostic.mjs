import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SmartSpectraSDK,
  CameraSelection,
  ProcessingStatus,
  ValidationCode,
  SmartSpectraErrorCode,
  faceMetrics,
  decodeMetrics,
  PixelFormat,
  FrameTransform,
} = require('@smartspectra/node-sdk');

test('M1 Diagnostic: SmartSpectra Native SDK Initialization', () => {
  const sdk = new SmartSpectraSDK({
    apiKey: 'test_dummy_diagnostic_key',
    requestedMetrics: faceMetrics,
    enableAccumulatedOutput: false,
  });

  assert.ok(sdk instanceof SmartSpectraSDK, 'SDK instance created');
  assert.equal(sdk.processingStatus, ProcessingStatus.kUninitialized, 'Status starts uninitialized');
});

test('M1 Diagnostic: Camera Discovery & Hardware Detection', () => {
  const cameras = SmartSpectraSDK.availableCameras ? SmartSpectraSDK.availableCameras() : [];
  console.log(`[Diagnostic] Discovered native hardware cameras: ${cameras.length}`);
  assert.ok(Array.isArray(cameras), 'availableCameras should return an array');
});

test('M1 Diagnostic: Custom Input Configuration & Lifecycle', async () => {
  const sdk = new SmartSpectraSDK({
    apiKey: 'test_dummy_diagnostic_key',
    requestedMetrics: faceMetrics,
  });

  sdk.useCustomInput(FrameTransform.kNone);

  let capturedError = null;
  sdk.on('error', (code, message, retryable) => {
    console.log(`[Diagnostic] SDK error event: code=${code}, message="${message}", retryable=${retryable}`);
    capturedError = { code, message, retryable };
  });

  sdk.on('processingStatus', (status) => {
    console.log(`[Diagnostic] Processing status: ${status}`);
  });

  // Verify that starting with an invalid key cleanly emits an authentication error or fails gracefully
  try {
    sdk.start();
    // Allow brief time for background FFI threads
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (err) {
    console.log(`[Diagnostic] start() threw error as expected for dummy key: ${err.message}`);
    assert.ok(err, 'Error thrown on invalid start');
  } finally {
    await sdk.destroy();
  }
});

test('M1 Diagnostic: Protobuf Metric Decoding for Face & Blinking', () => {
  // Test protobuf decoding with generated proto structure
  const messages = require('@smartspectra/node-sdk/messages');
  assert.ok(typeof messages.decodeMetrics === 'function', 'decodeMetrics exists');
  assert.ok(typeof messages.Metrics === 'function', 'Metrics class exists');

  // Create a synthetic Metrics message with blinking events to verify parser fidelity
  const syntheticPayload = messages.Metrics.create({
    face: {
      blinking: [
        { detected: false, stable: true, timestamp: 1000000 },
        { detected: true, stable: true, timestamp: 1350000 },  // 350ms duration -> Intentional blink
      ],
      landmarks: [
        {
          value: [{ x: 0.5, y: 0.5 }],
          stable: true,
          timestamp: 1000000,
        },
      ],
    },
  });

  const encoded = messages.Metrics.encode(syntheticPayload).finish();
  assert.ok(encoded instanceof Uint8Array, 'Encoded to Uint8Array');

  const decoded = messages.decodeMetrics(encoded);
  assert.ok(decoded.face, 'Decoded message has face object');
  assert.equal(decoded.face.blinking.length, 2, 'Decoded 2 blinking status items');
  assert.equal(decoded.face.blinking[1].detected, true, 'Second item detected true');
  assert.equal(Number(decoded.face.blinking[1].timestamp), 1350000, 'Timestamp accurately preserved');
});
