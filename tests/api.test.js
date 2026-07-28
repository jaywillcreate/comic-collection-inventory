import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';

function startServer(options = {}) {
  const uploadDir = mkdtempSync(path.join(tmpdir(), 'longbox-uploads-'));
  const app = createApp({ dbPath: ':memory:', uploadDir, ...options });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      resolve({
        base,
        close: () =>
          new Promise((r) => {
            server.close(r);
            rmSync(uploadDir, { recursive: true, force: true });
          }),
      });
    });
  });
}

async function json(res) {
  assert.ok(
    res.headers.get('content-type')?.includes('application/json'),
    'expected JSON response'
  );
  return res.json();
}

test('catalog API', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  await t.test('seeds the 30-record handoff catalog, default sort = highest value', async () => {
    const body = await json(await fetch(`${base}/api/comics?limit=100`));
    assert.equal(body.meta.collectionTotal, 30);
    assert.equal(body.meta.total, 30);
    assert.equal(body.meta.sort, 'value-desc');
    assert.equal(body.data[0].title, 'Action Comics #1');
    assert.equal(body.data[0].price, 3200000);
    assert.equal(body.data[0].era, 'Golden Age');
    assert.match(body.data[0].ref, /^LB-\d{5}$/);
  });

  await t.test('search AND-matches every whitespace-separated term', async () => {
    let body = await json(
      await fetch(`${base}/api/comics?q=${encodeURIComponent('first appearance batman')}`)
    );
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].series, 'Detective Comics');

    // one term matches creators, the other matches year
    body = await json(
      await fetch(`${base}/api/comics?q=${encodeURIComponent('moore 1986')}`)
    );
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].series, 'Watchmen');

    // issues are searchable as "#15", as composed in the prototype haystack
    body = await json(
      await fetch(`${base}/api/comics?q=${encodeURIComponent('#15 spider')}`)
    );
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].series, 'Amazing Fantasy');
  });

  await t.test('facets are multi-select in-group, AND across groups', async () => {
    const body = await json(
      await fetch(`${base}/api/comics?publisher=Vertigo&publisher=Image&genre=Horror&limit=100`)
    );
    // Horror from Vertigo/Image: Spawn, The Walking Dead, Bitter Root
    assert.equal(body.meta.total, 3);
    for (const rec of body.data) {
      assert.ok(['Vertigo', 'Image'].includes(rec.publisher));
      assert.equal(rec.genre, 'Horror');
    }
  });

  await t.test('facet counts exclude their own group but respect the others', async () => {
    const body = await json(await fetch(`${base}/api/comics?publisher=Vertigo`));
    const pub = Object.fromEntries(body.facets.publisher.map((o) => [o.value, o.count]));
    // Publisher counts ignore the publisher filter itself — DC stays pickable
    assert.equal(pub['DC Comics'], 9);
    assert.equal(pub['Vertigo'], 3);
    // Genre counts DO respect the publisher filter (Vertigo only)
    const genre = Object.fromEntries(body.facets.genre.map((o) => [o.value, o.count]));
    assert.equal(genre['Crime'], 1); // Preacher
    assert.equal(genre['Sci-Fi'], 1); // Y: The Last Man
    assert.equal(genre['Fantasy'], 1); // The Sandman
    assert.equal(genre['Superhero'] ?? 0, 0);
    // Active flags reflect the applied filter
    assert.ok(body.facets.publisher.find((o) => o.value === 'Vertigo').active);
  });

  await t.test('era facet derives from year ranges', async () => {
    const body = await json(await fetch(`${base}/api/comics?era=Golden%20Age&limit=100`));
    assert.equal(body.meta.total, 6); // 1938–1942 seed rows
    for (const rec of body.data) assert.ok(rec.year < 1956);
  });

  await t.test('keyOnly keeps only records with a key note', async () => {
    const body = await json(await fetch(`${base}/api/comics?keyOnly=true&limit=100`));
    assert.equal(body.meta.total, 22);
    assert.ok(body.data.every((r) => r.isKey && r.keyNote !== ''));
  });

  await t.test('price ceiling maps 0–100 logarithmically; 100 = no cap', async () => {
    // p=50 → 10^(1 + 2.8) = 10^3.8 ≈ $6,310
    const body = await json(await fetch(`${base}/api/comics?priceCap=50&limit=100`));
    assert.equal(body.meta.priceCapValue, 6310);
    assert.ok(body.data.every((r) => r.price <= 6310));
    assert.ok(body.data.some((r) => r.series === 'Green Lantern')); // $4,200 stays in

    const uncapped = await json(await fetch(`${base}/api/comics?priceCap=100`));
    assert.equal(uncapped.meta.priceCapValue, null);
    assert.equal(uncapped.meta.total, 30);
  });

  await t.test('all six sort orders from the toolbar', async () => {
    const first = async (sort) =>
      (await json(await fetch(`${base}/api/comics?sort=${sort}&limit=1`))).data[0];
    assert.equal((await first('year-asc')).year, 1938);
    assert.equal((await first('year-desc')).year, 2021);
    assert.equal((await first('value-desc')).price, 3200000);
    assert.equal((await first('grade-desc')).grade, 9.9);
    assert.equal((await first('title-asc')).series, 'Action Comics');
  });

  await t.test('pagination caps and offsets', async () => {
    const page = await json(await fetch(`${base}/api/comics?limit=5&offset=5&sort=year-asc`));
    assert.equal(page.data.length, 5);
    assert.equal(page.meta.total, 30);
    assert.equal(page.meta.offset, 5);
  });

  await t.test('record sheet includes era, ref and the census bars', async () => {
    const list = await json(await fetch(`${base}/api/comics?q=sandman`));
    const rec = await json(await fetch(`${base}/api/comics/${list.data[0].id}`));
    assert.equal(rec.era, 'Modern Age');
    assert.equal(rec.census.length, 8);
    const own = rec.census.find((b) => b.isRecordGrade);
    assert.equal(own.grade, 9.4);
    assert.equal(own.height, 70); // max(8, round(70*e^0)) at dist 0
    const far = rec.census.find((b) => b.grade === 6.0);
    assert.equal(far.height, 8); // clamped floor
  });

  await t.test('404 for unknown record and unknown route', async () => {
    assert.equal((await fetch(`${base}/api/comics/nope`)).status, 404);
    assert.equal((await fetch(`${base}/api/nothing-here`)).status, 404);
  });
});

test('CMS write API', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  await t.test('accession applies the design defaults', async () => {
    const res = await fetch(`${base}/api/comics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ series: '  Radiant Black  ' }),
    });
    assert.equal(res.status, 201);
    const rec = await json(res);
    assert.equal(rec.series, 'Radiant Black');
    assert.equal(rec.issue, '1');
    assert.equal(rec.publisher, 'Independent');
    assert.equal(rec.year, new Date().getFullYear());
    assert.equal(rec.genre, 'Indie');
    assert.equal(rec.grade, 9.0);
    assert.equal(rec.price, 0);
    assert.equal(rec.isKey, false);

    // Adds appear first under "Recently added"
    const body = await json(await fetch(`${base}/api/comics?sort=added-desc&limit=1`));
    assert.equal(body.data[0].id, rec.id);
    assert.equal(body.meta.collectionTotal, 31);
  });

  await t.test('series is required — same message as the design flash', async () => {
    const res = await fetch(`${base}/api/comics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publisher: 'Image' }),
    });
    assert.equal(res.status, 400);
    assert.equal((await json(res)).error, 'Series is required');
  });

  await t.test('data-URL covers are rejected toward the upload endpoint', async () => {
    const res = await fetch(`${base}/api/comics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ series: 'X', image: 'data:image/png;base64,AAAA' }),
    });
    assert.equal(res.status, 400);
    assert.match((await json(res)).error, /uploads\/covers/);
  });

  await t.test('PATCH edits in place, only supplied fields', async () => {
    const list = await json(await fetch(`${base}/api/comics?q=spawn`));
    const id = list.data[0].id;
    const res = await fetch(`${base}/api/comics/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grade: '9.6', price: 250 }),
    });
    const rec = await json(res);
    assert.equal(rec.grade, 9.6);
    assert.equal(rec.price, 250);
    assert.equal(rec.series, 'Spawn'); // untouched
    assert.equal(rec.keyNote, 'First appearance of Spawn');
  });

  await t.test('DELETE removes immediately; stats and seed-reset round-trip', async () => {
    const list = await json(await fetch(`${base}/api/comics?q=watchmen`));
    const del = await fetch(`${base}/api/comics/${list.data[0].id}`, { method: 'DELETE' });
    assert.equal(del.status, 204);

    let stats = await json(await fetch(`${base}/api/stats`));
    assert.equal(stats.records, 30); // 30 seed + 1 add - 1 delete
    assert.equal(stats.publishers, 8); // 7 seed publishers + Independent

    const reset = await fetch(`${base}/api/admin/seed-reset`, { method: 'POST' });
    assert.equal(reset.status, 200);
    stats = await json(await fetch(`${base}/api/stats`));
    assert.equal(stats.records, 30);
    assert.equal(stats.keyIssues, 22);
    assert.equal(stats.publishers, 7);
    assert.equal(stats.missingScans, 30);
    assert.equal(stats.cataloguedValue, 9855010); // sum of the 30 seed prices
  });
});

test('meta endpoint lists options and ticker feed', async (t) => {
  const { base, close } = await startServer();
  t.after(close);
  const meta = await json(await fetch(`${base}/api/meta`));
  assert.equal(meta.defaultSort, 'value-desc');
  assert.equal(meta.eras.length, 5);
  assert.equal(meta.genres.length, 8);
  assert.equal(meta.publishers.length, 7);
  assert.ok(meta.ticker.includes('CGC census'));
  assert.ok(meta.ticker.includes('First appearances'));
});

test('cover upload stores the file and serves it back', async (t) => {
  const { base, close } = await startServer();
  t.after(close);

  // 1×1 transparent PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  const form = new FormData();
  form.append('cover', new Blob([png], { type: 'image/png' }), 'cover.png');

  const res = await fetch(`${base}/api/uploads/covers`, { method: 'POST', body: form });
  assert.equal(res.status, 201);
  const { url } = await json(res);
  assert.match(url, /^\/uploads\/covers\/[a-z0-9-]+\.png$/);

  const served = await fetch(`${base}${url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');

  // Reject non-image uploads
  const bad = new FormData();
  bad.append('cover', new Blob(['#!/bin/sh'], { type: 'text/x-sh' }), 'evil.sh');
  const badRes = await fetch(`${base}/api/uploads/covers`, { method: 'POST', body: bad });
  assert.equal(badRes.status, 415);
});

test('API key guard protects writes when configured', async (t) => {
  const { base, close } = await startServer({ apiKey: 'secret-key' });
  t.after(close);

  // Reads stay public
  assert.equal((await fetch(`${base}/api/comics`)).status, 200);

  const attempt = (headers = {}) =>
    fetch(`${base}/api/comics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ series: 'Locked' }),
    });

  assert.equal((await attempt()).status, 401);
  assert.equal((await attempt({ 'x-api-key': 'wrong' })).status, 401);
  assert.equal((await attempt({ 'x-api-key': 'secret-key' })).status, 201);
});
