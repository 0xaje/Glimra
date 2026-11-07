import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = join(__dirname, '..', 'tests');

const testFiles = readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => join(testsDir, file));

if (testFiles.length === 0) {
  console.error('[test-runner] No test files found in tests/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
