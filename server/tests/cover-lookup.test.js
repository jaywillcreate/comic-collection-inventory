import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CoverLookup,
  buildSummary,
  htmlToText,
  normalize,
  pickBestVolume,
  similarity,
} from '../src/services/cover-lookup.js';

test('normalize strips punctuation, stopwords and apostrophes', () => {
  assert.equal(normalize("Grimm's Ghost Stories: A Witch's Brew"), 'grimms ghost stories witchs brew');
  assert.equal(normalize('The Amazing Spider-Man'), 'amazing spider man');
});

test('similarity ranks closer titles higher', () => {
  const spawn = similarity('Spawn', 'Spawn');
  const notSpawn = similarity('Spawn', 'Spawn: The Dark Ages');
  assert.equal(spawn, 1);
  assert.ok(notSpawn < spawn && notSpawn > 0.3);
});

test('pickBestVolume matches descriptive collection titles', () => {
  const volumes = [
    { id: 1, name: 'The Spectacular Spider-Man', publisher: { name: 'Marvel' }, count_of_issues: 263 },
    { id: 2, name: 'Spectacular Spider-Man Adventures', publisher: { name: 'Panini' }, count_of_issues: 200 },
    { id: 3, name: 'Spider-Man', publisher: { name: 'Marvel' }, count_of_issues: 98 },
  ];
  const rec = { series: 'The Spectacular Spider-man', issue: '201', publisher: 'Marvel' };
  assert.equal(pickBestVolume(rec, volumes).id, 1);

  // A volume too small to contain the issue loses to one that can hold it
  const withAmazing = [
    ...volumes,
    { id: 4, name: 'The Amazing Spider-Man', publisher: { name: 'Marvel' }, count_of_issues: 441 },
  ];
  const rec2 = { series: 'The Return of the Amazing Spider-man', issue: '407', publisher: 'Marvel' };
  assert.equal(pickBestVolume(rec2, withAmazing).id, 4);
});

test('pickBestVolume returns null below the confidence threshold', () => {
  const volumes = [{ id: 9, name: 'Completely Unrelated', publisher: { name: 'Nobody' }, count_of_issues: 5 }];
  assert.equal(pickBestVolume({ series: 'Spawn', issue: '1', publisher: 'Image' }, volumes), null);
});

test('htmlToText flattens Comic Vine HTML', () => {
  assert.equal(
    htmlToText('<p>Al Simmons <em>returns</em>.</p><p>He&#39;s angry &amp; armed.</p>'),
    "Al Simmons returns. He's angry & armed."
  );
});

test('buildSummary prefixes the story title and truncates at a sentence', () => {
  const details = {
    name: 'Bloodfeud',
    deck: '',
    description: `<p>${'Al Simmons faces his past. '.repeat(40)}</p>`,
  };
  const s = buildSummary(details, 200);
  assert.ok(s.startsWith('“Bloodfeud” — Al Simmons faces his past.'));
  assert.ok(s.length <= 220);
  assert.match(s, /\.$/); // ends on a sentence boundary
  assert.equal(buildSummary(null), '');
  assert.equal(buildSummary({ name: '', deck: '', description: '' }), '');
});

test('CoverLookup.resolve walks search → issues and returns the image URL', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push(u.pathname);
    if (u.pathname.endsWith('/search/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          error: 'OK',
          results: [{ id: 42, name: 'Spawn', publisher: { name: 'Image' }, count_of_issues: 350 }],
        }),
      };
    }
    const filter = u.searchParams.get('filter');
    assert.match(filter, /volume:42,issue_number:\d+/);
    const num = filter.match(/issue_number:(\d+)/)[1];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        error: 'OK',
        results: [{ issue_number: num, image: { super_url: `https://cv.example/spawn-${num}.jpg` } }],
      }),
    };
  };

  const lookup = new CoverLookup('test-key', { fetchImpl });
  const rec = { series: 'Spawn', issue: '318', publisher: 'Image' };
  assert.equal(await lookup.resolve(rec), 'https://cv.example/spawn-318.jpg');

  // Volume lookups are cached — a second resolve only hits /issues/
  await lookup.resolve({ ...rec, issue: '319' });
  assert.equal(calls.filter((p) => p.endsWith('/search/')).length, 1);

  // Non-numeric issues are skipped without any API calls
  assert.equal(await lookup.resolve({ series: 'Spawn', issue: 'Annual', publisher: 'Image' }), null);
});
