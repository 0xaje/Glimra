import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT_DIR = resolve(process.argv[2] || '.hallmark/screenshots/after');
const DIST_DIR = resolve('dist');
const PORT = 4180;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
};

const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];

mkdirSync(OUT_DIR, { recursive: true });

function startStaticServer() {
  const server = createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';

    let filePath = join(DIST_DIR, reqPath);
    if (!existsSync(filePath)) {
      filePath = join(resolve('public'), reqPath);
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(readFileSync(filePath));
    } else {
      const indexPath = join(DIST_DIR, 'index.html');
      if (existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(indexPath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const actualPort = server.address().port;
      console.log(`Static server running on http://127.0.0.1:${actualPort}`);
      resolveServer({ server, port: actualPort });
    });
  });
}

async function run() {
  const { server, port } = await startStaticServer();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\nCapturing viewport ${vp.name} into ${OUT_DIR}...`);

      // 1. First-launch (Empty state)
      {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 600));
        const path = join(OUT_DIR, `01-first-launch-${vp.name}.png`);
        await page.screenshot({ path });
        console.log(`✓ Saved ${path}`);
        await page.close();
      }

      // 2. Loaded deck
      {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 400));
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const starterBtn = btns.find((b) => b.textContent && (b.textContent.includes('starter') || b.textContent.includes('sample') || b.textContent.includes('Sample')));
          if (starterBtn) starterBtn.click();
        });
        await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1200));
        const path = join(OUT_DIR, `02-loaded-deck-${vp.name}.png`);
        await page.screenshot({ path });
        console.log(`✓ Saved ${path}`);
        await page.close();
      }

      // 3. Settings Modal
      {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 400));
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const settingsBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'Settings');
          if (settingsBtn) settingsBtn.click();
        });
        await new Promise((r) => setTimeout(r, 600));
        const path = join(OUT_DIR, `03-settings-${vp.name}.png`);
        await page.screenshot({ path });
        console.log(`✓ Saved ${path}`);
        await page.close();
      }

      // 4. Guide Modal
      {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 400));
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const guideBtn = btns.find((b) => b.textContent && b.textContent.trim() === 'Guide');
          if (guideBtn) guideBtn.click();
        });
        await new Promise((r) => setTimeout(r, 600));
        const path = join(OUT_DIR, `04-guide-${vp.name}.png`);
        await page.screenshot({ path });
        console.log(`✓ Saved ${path}`);
        await page.close();
      }

      // 5. Presenter HUD (Loaded deck + Active HUD overlay)
      {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
        await new Promise((r) => setTimeout(r, 400));
        // First, load deck
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const starterBtn = btns.find((b) => b.textContent && (b.textContent.includes('starter') || b.textContent.includes('sample') || b.textContent.includes('Sample')));
          if (starterBtn) starterBtn.click();
        });
        await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 800));

        // Click Enable hands-free
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('header button'));
          const handsFreeBtn = btns.find((b) => b.textContent && b.textContent.includes('hands-free'));
          if (handsFreeBtn) handsFreeBtn.click();
        });
        await new Promise((r) => setTimeout(r, 400));

        // Confirm camera consent in modal
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const consentBtn = btns.find((b) => b.textContent && (b.textContent.includes('agree') || b.textContent.includes('Enable camera')));
          if (consentBtn) consentBtn.click();
        });
        await new Promise((r) => setTimeout(r, 800));

        const path = join(OUT_DIR, `05-presenter-hud-${vp.name}.png`);
        await page.screenshot({ path });
        console.log(`✓ Saved ${path}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nAll screenshots successfully captured in ${OUT_DIR}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
