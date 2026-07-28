import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValueLookup,
  listingMatches,
  robustMedian,
} from '../src/services/value-lookup.js';

test('listingMatches requires the issue number and rejects lots/reprints', () => {
  const rec = { issue: '318' };
  assert.ok(listingMatches(rec, 'Spawn #318 Cover D McFarlane 2021'));
  assert.ok(listingMatches(rec, 'SPAWN 318 NM'));
  assert.ok(!listingMatches(rec, 'Spawn #317 NM')); // wrong issue
  assert.ok(!listingMatches(rec, 'Spawn #310-320 lot of 11')); // lot
  assert.ok(!listingMatches(rec, 'Spawn #318 facsimile reprint'));
  assert.ok(!listingMatches(rec, 'Spawn 3180 variant')); // not a token match
});

test('robustMedian trims outliers and refuses thin samples', () => {
  assert.equal(robustMedian([10, 12, 11, 13, 500]), 12); // outlier dropped
  assert.equal(robustMedian([20, 30, 40]), 30);
  assert.equal(robustMedian([5, 9]), null); // too thin
  assert.equal(robustMedian([]), null);
});

test('ValueLookup.estimate authenticates once and computes a labeled sample', async () => {
  let tokenCalls = 0;
  const fetchImpl = async (url, opts = {}) => {
    const href = String(url);
    if (href.includes('/oauth2/token')) {
      tokenCalls++;
      assert.match(opts.headers.authorization, /^Basic /);
      return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 7200 }) };
    }
    assert.equal(opts.headers.authorization, 'Bearer tok');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        itemSummaries: [
          { title: 'Spawn #318 NM', price: { value: '11.99', currency: 'USD' } },
          { title: 'Spawn 318 Cover A', price: { value: '14.00', currency: 'USD' } },
          { title: 'Spawn #318 CGC', price: { value: '13.00', currency: 'USD' } },
          { title: 'Spawn #310-320 lot', price: { value: '99.00', currency: 'USD' } },
          { title: 'Spawn #318', price: { value: '12.50', currency: 'EUR' } },
          { title: 'Spawn #318 signed', price: { value: '900.00', currency: 'USD' } },
        ],
      }),
    };
  };

  const lookup = new ValueLookup('id', 'secret', { fetchImpl });
  const est = await lookup.estimate({ series: 'Spawn', issue: '318', grade: 0 });
  // USD, matching, non-lot listings: 11.99, 14.00, 13.00 (+900 trimmed by IQR)
  assert.equal(est.value, 13);
  assert.ok(est.sampleSize >= 3);

  await lookup.estimate({ series: 'Spawn', issue: '319', grade: 0 });
  assert.equal(tokenCalls, 1); // token cached
});
