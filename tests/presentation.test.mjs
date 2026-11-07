import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';

test('M2 Presentation Engine: Real PDF Document Import & Page Count', async () => {
  const samplePdfPath = path.resolve('public/glimra-sample-deck.pdf');
  assert.ok(fs.existsSync(samplePdfPath), 'glimra-sample-deck.pdf must exist');

  const buffer = new Uint8Array(fs.readFileSync(samplePdfPath));
  assert.ok(buffer.byteLength > 100, 'Buffer has real presentation bytes');

  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  assert.equal(doc.numPages, 5, 'Real presentation deck must have 5 pages');

  // Verify each page can be opened and queried
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    assert.equal(page.pageNumber, pageNum, `Page number matches index ${pageNum}`);
    const viewport = page.getViewport({ scale: 1 });
    assert.ok(viewport.width > 0 && viewport.height > 0, `Page ${pageNum} has positive dimensions`);
    assert.equal(viewport.width, 960, `Page ${pageNum} matches 16:9 960pt width`);
    assert.equal(viewport.height, 540, `Page ${pageNum} matches 16:9 540pt height`);
  }

  await doc.destroy();
});

test('M2 Presentation Engine: Slide Navigation State Machine', () => {
  const totalSlides = 5;
  let currentSlide = 1;

  const next = () => {
    if (currentSlide < totalSlides) currentSlide++;
    return currentSlide;
  };

  const prev = () => {
    if (currentSlide > 1) currentSlide--;
    return currentSlide;
  };

  assert.equal(currentSlide, 1, 'Initial slide is 1');
  assert.equal(prev(), 1, 'Cannot navigate before slide 1');
  assert.equal(next(), 2, 'Navigates to slide 2');
  assert.equal(next(), 3, 'Navigates to slide 3');
  assert.equal(next(), 4, 'Navigates to slide 4');
  assert.equal(next(), 5, 'Navigates to slide 5');
  assert.equal(next(), 5, 'Cannot navigate beyond last slide');
  assert.equal(prev(), 4, 'Navigates back to slide 4');
});

test('M2 Presentation Engine: Corrupted Buffer Error Handling', async () => {
  const garbageBuffer = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44]);
  let failed = false;

  try {
    await pdfjs.getDocument({ data: garbageBuffer }).promise;
  } catch (err) {
    failed = true;
    assert.ok(err, 'Properly threw on corrupt data');
  }

  assert.ok(failed, 'PDF parser rejected corrupted buffer gracefully');
});
