import { spawn } from 'node:child_process';
import http from 'node:http';

async function waitForServer(port) {
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.end();
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Server did not respond on port ${port}`);
}

async function run() {
  console.log('Starting preview server on port 4173...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    stdio: 'inherit',
  });

  try {
    await waitForServer(4173);
    console.log('Server is ready. Running sloplint --render...');

    const sloplint = spawn(
      'node',
      [
        '.agents/skills/hallmark/scripts/sloplint.mjs',
        'src/',
        '--scope',
        'app',
        '--render',
        '--url',
        'http://localhost:4173/',
      ],
      { stdio: 'inherit' }
    );

    await new Promise((resolve, reject) => {
      sloplint.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`sloplint exited with code ${code}`));
      });
    });
  } finally {
    preview.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
