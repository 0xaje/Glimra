import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Glimra Foundation — Core Documentation Suite', () => {
  const requiredDocs = [
    'AGENTS.md',
    'README.md',
    'LICENSE',
    'docs/PROGRESS.md',
    'docs/ARCHITECTURE.md',
    'docs/DESIGN_SYSTEM.md',
    'docs/SDK_VERIFICATION.md',
    'docs/TEST_REPORT.md',
    'docs/PRIVACY.md',
    'docs/RELEASE_CHECKLIST.md',
    'docs/DECISIONS.md',
  ];

  for (const doc of requiredDocs) {
    const fullPath = path.resolve(doc);
    assert.ok(fs.existsSync(fullPath), `Expected ${doc} to exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.length > 50, `Expected ${doc} to have substantial content`);
  }
});

test('Glimra Foundation — Security Audit (No Committed Credentials)', () => {
  const forbiddenPatterns = [
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z-_]{35}/,
    /ghp_[0-9a-zA-Z]{36}/,
  ];

  const inspectFiles = [
    'README.md',
    'package.json',
    'docs/ARCHITECTURE.md',
    'docs/SDK_VERIFICATION.md',
    'src/renderer/src/App.tsx',
    'src/main/main.ts',
  ];

  for (const relPath of inspectFiles) {
    const content = fs.readFileSync(path.resolve(relPath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.ok(!pattern.test(content), `Found forbidden credential pattern in ${relPath}`);
    }
  }
});

test('Glimra Foundation — SmartSpectra SDK Native Export Surface', () => {
  const sdk = require('@smartspectra/node-sdk');
  assert.ok(typeof sdk.SmartSpectraSDK === 'function', 'SmartSpectraSDK should be a constructor');
  assert.ok(Array.isArray(sdk.faceMetrics), 'faceMetrics bundle should be an array');
  assert.ok(sdk.faceMetrics.includes(12), 'faceMetrics should include BLINKING (12)');
  assert.ok(typeof sdk.decodeMetrics === 'function', 'decodeMetrics function should be exported');
});

test('Glimra Foundation — Build Artifacts Generated', (t) => {
  if (!fs.existsSync(path.resolve('dist/index.html'))) {
    t.skip('Build artifacts not generated yet (run npm run build first)');
    return;
  }
  assert.ok(fs.existsSync(path.resolve('dist/index.html')), 'dist/index.html must exist');
  assert.ok(fs.existsSync(path.resolve('dist-electron/main.js')), 'dist-electron/main.js must exist');
  assert.ok(fs.existsSync(path.resolve('dist-electron/preload.js')), 'dist-electron/preload.js must exist');
});
