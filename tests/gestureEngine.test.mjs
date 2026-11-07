import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine } from '../src/renderer/src/engine/gestureEngine.ts';

test('M3 Gesture Engine: Involuntary Blinks (<350ms) are Ignored', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350 });
  engine.setFaceValidation(true);

  let t = 1000000; // 1,000,000 µs = 1,000 ms

  // Eyes open
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none');

  // Eyes close for 180ms (typical human involuntary blink)
  t += 10000;
  res = engine.processSample(true, true, t);
  assert.equal(res.command, 'none');

  t += 180000; // +180ms
  res = engine.processSample(false, true, t);
  // Must NOT trigger slide change
  assert.equal(res.command, 'none', '180ms involuntary blink must not trigger next slide');
  assert.equal(res.chargeRatio, 0);
});

test('M3 Gesture Engine: Unstable Biometric Samples Are Discarded', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350 });
  engine.setFaceValidation(true);

  let t = 2000000;

  // Eyes close with stable = false (noisy frame, lighting flicker, motion blur)
  let res = engine.processSample(true, false, t);
  assert.equal(res.command, 'none');
  assert.equal(res.chargeRatio, 0, 'Unstable sample must not accumulate charge');

  // Next sample remains unstable
  t += 400000;
  res = engine.processSample(true, false, t);
  assert.equal(res.command, 'none');

  // Eye reopens but sample was unstable
  t += 50000;
  res = engine.processSample(false, false, t);
  assert.equal(res.command, 'none', 'Unstable closure must never trigger command');
});

test('M3 Gesture Engine: Non-monotonic & Stalled Timestamps Handled Safely', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350 });
  engine.setFaceValidation(true);

  let t = 3000000;
  engine.processSample(true, true, t);

  // Duplicate timestamp (deltaUs = 0)
  let res = engine.processSample(true, true, t);
  assert.equal(res.command, 'none');

  // Backwards timestamp (deltaUs < 0)
  res = engine.processSample(true, true, t - 50000);
  assert.equal(res.command, 'none', 'Backwards timestamp discarded');

  // Large timestamp gap (> 2 seconds stall)
  res = engine.processSample(true, true, t + 3000000);
  assert.equal(res.command, 'none', 'Stalled gap resets transient blink');
});

test('M3 Gesture Engine: Intentional Prolonged Blink (400ms) Advances Slide', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350, refractoryCooldownMs: 1200 });
  engine.setFaceValidation(true);

  let t = 5000000; // 5,000 ms

  // Eyes close
  let res = engine.processSample(true, true, t);
  assert.equal(res.command, 'none');

  // Eyes held shut for 200ms -> charge ratio ~0.57
  t += 200000;
  res = engine.processSample(true, true, t);
  assert.equal(res.command, 'none');
  assert.ok(res.chargeRatio > 0.5, 'Charge ratio reflects dwell progression');

  // Eyes reopened after 420ms total closure
  t += 220000; // total 420ms
  res = engine.processSample(false, true, t);

  // Must trigger 'next' command
  assert.equal(res.command, 'next', '420ms deliberate blink must trigger next slide');
  assert.ok(res.feedback, 'Feedback object exists');
  assert.equal(res.feedback.type, 'prolonged-blink');
});

test('M3 Gesture Engine: Refractory Cooldown Suppresses Double Advances', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350, refractoryCooldownMs: 1200 });
  engine.setFaceValidation(true);

  let t = 10000000; // 10,000 ms

  // Trigger first intentional blink
  engine.processSample(true, true, t);
  t += 400000; // 400ms
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'next', 'First command triggered');

  // Presenter closes eyes again 300ms later (within 1200ms refractory period)
  t += 300000;
  engine.processSample(true, true, t);
  t += 400000;
  res = engine.processSample(false, true, t);

  // Must be blocked by refractory cooldown
  assert.equal(res.command, 'none', 'Blink within 1200ms refractory window must be suppressed');

  // After 1300ms, a new intentional blink succeeds
  t += 1300000;
  engine.processSample(true, true, t);
  t += 400000;
  res = engine.processSample(false, true, t);
  assert.equal(res.command, 'next', 'Blink after refractory period succeeds');
});

test('M3 Gesture Engine: Verified Double Blink Triggers Previous Slide', () => {
  const engine = new GestureEngine({
    minDoubleBlinkDurationMs: 100,
    maxDoubleBlinkDurationMs: 280,
    minInterBlinkGapMs: 80,
    maxInterBlinkGapMs: 450,
  });
  engine.setFaceValidation(true);

  let t = 20000000; // 20,000 ms

  // First quick voluntary blink (150ms)
  engine.processSample(true, true, t);
  t += 150000;
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none');

  // Second quick voluntary blink 180ms later (150ms)
  t += 180000;
  engine.processSample(true, true, t);
  t += 150000;
  res = engine.processSample(false, true, t);

  assert.equal(res.command, 'prev', 'Rhythmic double blink triggers previous slide');
  assert.ok(res.feedback);
  assert.equal(res.feedback.type, 'double-blink');
});

test('M3 Gesture Engine: Double Blink Rejects Inappropriate Gaps and Durations', () => {
  const engine = new GestureEngine({
    minDoubleBlinkDurationMs: 100,
    maxDoubleBlinkDurationMs: 280,
    minInterBlinkGapMs: 80,
    maxInterBlinkGapMs: 450,
  });
  engine.setFaceValidation(true);

  let t = 25000000;

  // First blink is 320ms (too long to be a rapid double-blink sub-blink)
  engine.processSample(true, true, t);
  t += 320000;
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none');

  // Second blink follows
  t += 150000;
  engine.processSample(true, true, t);
  t += 150000;
  res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none', 'First blink was too long to form a valid double blink');
});

test('M3 Gesture Engine: Pause and Face Loss Disarm Processing Immediately', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 350 });
  engine.setFaceValidation(true);

  let t = 30000000;

  // Pause enabled
  engine.setPaused(true);
  engine.processSample(true, true, t);
  t += 450000;
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none', 'No command emitted when paused');

  // Resume but lose face validation (e.g. presenter turns away)
  engine.setPaused(false);
  engine.setFaceValidation(false);
  t += 1000000;
  engine.processSample(true, true, t);
  t += 450000;
  res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none', 'No command emitted when face tracking is invalid');
});

test('M3 Gesture Engine: Dynamic Sensitivity Tuning via updateConfig', () => {
  const engine = new GestureEngine({ minIntentionalBlinkMs: 380 });
  assert.equal(engine.getConfig().minIntentionalBlinkMs, 380);

  // Switch to responsive mode (320ms)
  engine.updateConfig({ minIntentionalBlinkMs: 320 });
  assert.equal(engine.getConfig().minIntentionalBlinkMs, 320);

  engine.setFaceValidation(true);
  let t = 40000000;
  engine.processSample(true, true, t);
  t += 330000; // 330ms closure
  let res = engine.processSample(false, true, t);
  assert.equal(res.command, 'next', '330ms closure triggers next in responsive mode');

  // Switch to deliberate mode (460ms)
  engine.updateConfig({ minIntentionalBlinkMs: 460 });
  assert.equal(engine.getConfig().minIntentionalBlinkMs, 460);

  t += 2000000;
  engine.processSample(true, true, t);
  t += 350000; // 350ms closure
  res = engine.processSample(false, true, t);
  assert.equal(res.command, 'none', '350ms closure ignored in deliberate 460ms mode');
});
