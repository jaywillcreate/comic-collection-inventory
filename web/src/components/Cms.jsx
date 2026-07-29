import { useEffect, useState } from 'react';
import {
  Archive,
  ArrowUDownLeft,
  Storefront,
  Bank,
  Books,
  Check,
  ChartLineUp,
  CurrencyDollar,
  Database,
  FlagPennant,
  Gavel,
  GlobeHemisphereWest,
  ImageSquare,
  PencilSimple,
  Plus,
  PlusCircle,
  Trash,
  X,
} from '@phosphor-icons/react';
import { Halftone, CoverSwatch } from './CoverPlate.jsx';
import { compQ, coverFor, coverQ, exact, median, money, muted } from '../lib/cover.js';
import { api, getAdminKey, hasStoredAdminKey, setAdminKey } from '../api.js';

const sectionLabel = {
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: muted(62),
  marginRight: 'auto',
};

const moduleBox = {
  border: '1px solid var(--color-divider)',
  borderRadius: 10,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const dashedBox = {
  border: '1px dashed var(--color-divider)',
  borderRadius: 8,
  padding: 11,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export default function Cms({
  stats,
  genres,
  publishers,
  form,
  setField,
  editingId,
  flash,
  onSubmit,
  onCancelEdit,
  inventory,
  adminQ,
  setAdminQ,
  onEdit,
  onDelete,
  onShowMore,
  uploadCover,
  settings,
  onSaveSettings,
}) {
  const [coverOpen, setCoverOpen] = useState(false);
  const [siteDraft, setSiteDraft] = useState({ siteTitle: '', siteTagline: '', logoUrl: '' });
  const [siteOpen, setSiteOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyStatus, setKeyStatus] = useState(
    hasStoredAdminKey() ? 'stored' : getAdminKey() ? 'build' : 'none'
  );
  const [keyMsg, setKeyMsg] = useState('');

  const verifyAndStoreKey = async () => {
    const key = keyDraft.trim();
    if (!key) return;
    const previous = hasStoredAdminKey() ? getAdminKey() : null;
    setAdminKey(key);
    try {
      await api.verifyAdminKey();
      setKeyStatus('stored');
      setKeyDraft('');
      setKeyMsg('Key verified — stored on this device.');
    } catch {
      if (previous) setAdminKey(previous);
      else setAdminKey('');
      setKeyStatus(previous ? 'stored' : getAdminKey() ? 'build' : 'none');
      setKeyMsg('That key was rejected by the server.');
    }
  };
  useEffect(() => {
    if (settings) {
      setSiteDraft({
        siteTitle: settings.siteTitle || '',
        siteTagline: settings.siteTagline || '',
        logoUrl: settings.logoUrl || '',
      });
    }
  }, [settings]);
  const [coverQuery, setCoverQuery] = useState('');
  const [coverPaste, setCoverPaste] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [compOpen, setCompOpen] = useState(false);
  const [compQuery, setCompQuery] = useState('');
  const [compEntry, setCompEntry] = useState('');
  const [comps, setComps] = useState([]);

  const statCards = stats
    ? [
        { Icon: Books, label: 'Records', value: stats.records, note: 'live in the public index' },
        { Icon: FlagPennant, label: 'Key issues', value: stats.keyIssues, note: 'flagged first appearances' },
        { Icon: ImageSquare, label: 'Missing scans', value: stats.missingScans, note: 'using generated plates' },
        { Icon: CurrencyDollar, label: 'Book value', value: money(stats.cataloguedValue), note: 'sum of market estimates' },
      ]
    : [];

  const addCoverUrl = (url) => {
    url = (url || '').trim();
    if (!url) return;
    setCandidates((list) => [url, ...list.filter((u) => u !== url)].slice(0, 12));
    setCoverPaste('');
    setField('image', url);
  };

  const addComp = (raw) => {
    const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (!n) return;
    setComps((list) => [...list, n]);
    setCompEntry('');
  };

  const onCoverDrop = async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) {
      const { url } = await uploadCover(dt.files[0]);
      addCoverUrl(url);
      return;
    }
    const txt = dt.getData('text/uri-list') || dt.getData('text/plain');
    const m = txt && txt.match(/https?:\/\/\S+/);
    if (m) addCoverUrl(m[0]);
  };

  const qq = encodeURIComponent(coverQuery || 'comic book cover');
  const coverSources = [
    { label: 'Image search', Icon: ImageSquare, url: `https://duckduckgo.com/?iax=images&ia=images&q=${qq}` },
    { label: 'Comic Vine', Icon: Database, url: `https://comicvine.gamespot.com/search/?i=&q=${qq}` },
    { label: 'GCD', Icon: Archive, url: `https://www.comics.org/searchNew/?q=${qq}` },
  ];
  const cq = encodeURIComponent(compQuery || 'comic book');
  const compSources = [
    { label: 'eBay sold', Icon: Gavel, url: `https://www.ebay.com/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=${cq}` },
    { label: 'GoCollect', Icon: ChartLineUp, url: `https://gocollect.com/search?q=${cq}` },
    { label: 'Heritage', Icon: Bank, url: `https://comics.ha.com/search-results.s?N=0&Ntt=${cq}` },
  ];

  const previewCover = coverFor(form.publisher || 'Independent', parseInt(form.year, 10) || 2020);

  return (
    <main
      style={{
        maxWidth: 1580,
        margin: '0 auto',
        padding: 'clamp(26px,4vw,48px) clamp(14px,3vw,34px) 96px',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16, marginBottom: 26 }}>
        <div style={{ marginRight: 'auto' }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              marginBottom: 10,
            }}
          >
            Connected CMS · writes to the live index
          </div>
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(38px,6.6vw,86px)',
              lineHeight: 0.8,
              letterSpacing: '-0.055em',
              textTransform: 'uppercase',
              fontVariationSettings: "'wght' 720",
            }}
          >
            Catalog
            <br />
            <span
              style={{
                color: 'transparent',
                WebkitTextStroke: '1.2px var(--color-accent)',
                fontVariationSettings: "'wght' 300",
              }}
            >
              management
            </span>
          </h2>
          <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
            Accession new books, update cover scans, correct grades. Changes publish to the
            public wall immediately.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setSiteOpen(!siteOpen)}>
          <Storefront size={14} />
          {siteOpen ? 'Close site settings' : 'Site settings'}
        </button>
      </div>

      {siteOpen && (
        <div
          className="lb-rise-in"
          style={{
            ...moduleBox,
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            border: 0,
            borderRadius: 14,
            padding: 18,
            marginBottom: 26,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Storefront size={14} style={{ color: 'var(--color-accent)' }} />
            <span style={sectionLabel}>Site identity</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label>Site title</label>
              <input
                className="input"
                value={siteDraft.siteTitle}
                onChange={(e) => setSiteDraft({ ...siteDraft, siteTitle: e.target.value })}
                placeholder="LONGBOX"
              />
            </div>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label>Tagline</label>
              <input
                className="input"
                value={siteDraft.siteTagline}
                onChange={(e) => setSiteDraft({ ...siteDraft, siteTagline: e.target.value })}
                placeholder="Archive & Index"
              />
            </div>
            <div className="field" style={{ flex: '2 1 240px' }}>
              <label>
                Logo image URL <span className="text-muted">— blank uses the spine mark</span>
              </label>
              <input
                className="input"
                value={siteDraft.logoUrl}
                onChange={(e) => setSiteDraft({ ...siteDraft, logoUrl: e.target.value })}
                placeholder="https://…logo.png"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn btn-primary" onClick={() => onSaveSettings(siteDraft)}>
              <Check size={14} />
              Save site settings
            </button>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-divider)',
              paddingTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={sectionLabel}>Admin access</span>
            <div style={{ fontSize: 12, color: muted(50), lineHeight: 1.5 }}>
              {keyStatus === 'stored'
                ? 'Unlocked with a key stored on this device.'
                : keyStatus === 'build'
                  ? 'Using the key baked into this build. Storing it here survives rebuilds and key rotations.'
                  : 'Locked — enter the admin API key to enable saving from this browser.'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                className="input"
                type="password"
                style={{ flex: '1 1 200px' }}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    verifyAndStoreKey();
                  }
                }}
                placeholder="Admin API key"
                autoComplete="off"
              />
              <button className="btn btn-primary" type="button" onClick={verifyAndStoreKey}>
                <Check size={14} />
                Verify &amp; store
              </button>
              {keyStatus === 'stored' && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setAdminKey('');
                    setKeyStatus(getAdminKey() ? 'build' : 'none');
                    setKeyMsg('Stored key removed from this device.');
                  }}
                >
                  Forget key
                </button>
              )}
            </div>
            {keyMsg && (
              <span style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>{keyMsg}</span>
            )}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 12,
          marginBottom: 26,
        }}
      >
        {statCards.map(({ Icon, label, value, note }) => (
          <div key={label} className="card elev-sm" style={{ gap: 6, padding: '14px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon size={15} style={{ color: 'var(--color-accent)' }} />
              <span className="card-kicker" style={{ color: muted(50) }}>
                {label}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 26,
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 11, color: muted(42) }}>{note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px,2.2vw,30px)', alignItems: 'flex-start' }}>
        {/* Accession form */}
        <form
          onSubmit={onSubmit}
          style={{
            flex: '1 1 336px',
            minWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'var(--color-surface)',
            borderRadius: 14,
            padding: 18,
            boxShadow: 'var(--shadow-sm)',
            position: 'sticky',
            top: 70,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <PlusCircle size={17} style={{ color: 'var(--color-accent)' }} />
            <h4
              style={{
                margin: 0,
                marginRight: 'auto',
                fontSize: 22,
                letterSpacing: '-0.03em',
                fontVariationSettings: "'wght' 640",
              }}
            >
              {editingId ? 'Edit record' : 'Accession a book'}
            </h4>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 74, flex: 'none' }}>
              <div
                style={{
                  aspectRatio: '2/3',
                  borderRadius: 6,
                  background: previewCover,
                  boxShadow: 'inset 3px 0 0 rgba(0,0,0,.5), var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {form.image && (
                  <div
                    role="img"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundImage: `url("${form.image}")`,
                    }}
                  />
                )}
                <Halftone />
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: muted(40),
                  marginTop: 6,
                  textAlign: 'center',
                }}
              >
                Preview
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <div className="field">
                <label>Series</label>
                <input
                  className="input"
                  value={form.series}
                  onChange={(e) => setField('series', e.target.value)}
                  placeholder="The Sandman"
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Issue</label>
                  <input
                    className="input"
                    value={form.issue}
                    onChange={(e) => setField('issue', e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Year</label>
                  <input
                    className="input"
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    placeholder="1989"
                  />
                </div>
              </div>
              <div className="field">
                <label>
                  Cover date <span className="text-muted">— YYYY-MM, auto-filled from the web</span>
                </label>
                <input
                  className="input"
                  value={form.coverDate}
                  onChange={(e) => setField('coverDate', e.target.value)}
                  placeholder="1989-01"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Publisher</label>
              <input
                className="input"
                value={form.publisher}
                onChange={(e) => setField('publisher', e.target.value)}
                list="lb-pubs"
                placeholder="Vertigo"
              />
            </div>
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label>Genre</label>
              <select
                className="input"
                value={form.genre}
                onChange={(e) => setField('genre', e.target.value)}
              >
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Character</label>
              <input
                className="input"
                value={form.character}
                onChange={(e) => setField('character', e.target.value)}
                placeholder="Spider-man"
              />
            </div>
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label>
                Cover variant <span className="text-muted">— optional</span>
              </label>
              <input
                className="input"
                value={form.variant}
                onChange={(e) => setField('variant', e.target.value)}
                placeholder="Cover B"
              />
            </div>
          </div>

          {/* Grade & value module */}
          <div style={moduleBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CurrencyDollar size={14} style={{ color: 'var(--color-accent)' }} />
              <span style={sectionLabel}>Grade &amp; value</span>
              <button
                className="btn btn-ghost"
                type="button"
                style={{ fontSize: 12 }}
                onClick={() => {
                  setCompOpen(!compOpen);
                  if (!compOpen && !compQuery) setCompQuery(compQ(form));
                }}
              >
                {compOpen ? 'Close comps' : 'Look up value'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 110px' }}>
                <label>Grade (CGC)</label>
                <input
                  className="input"
                  value={form.grade}
                  onChange={(e) => setField('grade', e.target.value)}
                  placeholder="9.4"
                />
              </div>
              <div className="field" style={{ flex: '1 1 130px' }}>
                <label>Market value (USD)</label>
                <input
                  className="input"
                  value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="480"
                />
              </div>
            </div>

            {compOpen && (
              <div className="lb-rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field">
                  <label>Search sold comps</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input"
                      value={compQuery}
                      onChange={(e) => setCompQuery(e.target.value)}
                      placeholder="Series, issue, grade"
                    />
                    <button
                      className="btn btn-secondary"
                      type="button"
                      title="Use record fields"
                      onClick={() => setCompQuery(compQ(form))}
                    >
                      <ArrowUDownLeft size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {compSources.map(({ label, Icon, url }) => (
                    <a
                      key={label}
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon size={13} />
                      {label}
                    </a>
                  ))}
                </div>
                <div style={dashedBox}>
                  <div style={{ fontSize: 11, color: muted(50), lineHeight: 1.45 }}>
                    Record what the comps sold for — the median becomes the suggested value.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input"
                      value={compEntry}
                      onChange={(e) => setCompEntry(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addComp(e.target.value);
                        }
                      }}
                      placeholder="e.g. 1,250"
                    />
                    <button className="btn btn-primary" type="button" onClick={() => addComp(compEntry)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {comps.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {comps.map((v, i) => (
                        <button
                          key={i}
                          className="tag tag-neutral lb-chip"
                          type="button"
                          style={{ fontVariantNumeric: 'tabular-nums', border: 0 }}
                          onClick={() => setComps(comps.filter((_, j) => j !== i))}
                        >
                          {exact(v)}
                          <X size={10} style={{ opacity: 0.6 }} />
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: muted(55) }}>
                        Median of {comps.length} ·{' '}
                        <span style={{ color: 'var(--color-accent-300)', fontVariantNumeric: 'tabular-nums' }}>
                          {exact(median(comps))}
                        </span>
                      </div>
                      <button
                        className="btn btn-primary"
                        type="button"
                        style={{ fontSize: 12, marginLeft: 'auto' }}
                        onClick={() => setField('price', String(median(comps)), 'Value set from comps')}
                      >
                        <Check size={13} />
                        Use median
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label>Creators</label>
            <input
              className="input"
              value={form.creators}
              onChange={(e) => setField('creators', e.target.value)}
              placeholder="Gaiman & Kieth"
            />
          </div>
          <div className="field">
            <label>
              Key note <span className="text-muted">— first appearance, milestone</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: 62 }}
              value={form.keyNote}
              onChange={(e) => setField('keyNote', e.target.value)}
              placeholder="First appearance of Morpheus"
            />
          </div>
          <div className="field">
            <label>
              Synopsis <span className="text-muted">— auto-filled from the web; edits stick</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: 62 }}
              value={form.summary}
              onChange={(e) => setField('summary', e.target.value)}
              placeholder="Fetched from Comic Vine on first view — or write your own"
            />
          </div>

          {/* Cover image module */}
          <div style={moduleBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GlobeHemisphereWest size={14} style={{ color: 'var(--color-accent)' }} />
              <span style={sectionLabel}>Cover image</span>
              <button
                className="btn btn-ghost"
                type="button"
                style={{ fontSize: 12 }}
                onClick={() => {
                  setCoverOpen(!coverOpen);
                  if (!coverOpen && !coverQuery) setCoverQuery(coverQ(form));
                }}
              >
                {coverOpen ? 'Close search' : 'Find on the web'}
              </button>
            </div>

            {coverOpen && (
              <div className="lb-rise-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field">
                  <label>Search the web</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input"
                      value={coverQuery}
                      onChange={(e) => setCoverQuery(e.target.value)}
                      placeholder="Series, issue, publisher"
                    />
                    <button
                      className="btn btn-secondary"
                      type="button"
                      title="Use series and issue"
                      onClick={() => setCoverQuery(coverQ(form))}
                    >
                      <ArrowUDownLeft size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {coverSources.map(({ label, Icon, url }) => (
                    <a
                      key={label}
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon size={13} />
                      {label}
                    </a>
                  ))}
                </div>
                <div onDrop={onCoverDrop} onDragOver={(e) => e.preventDefault()} style={dashedBox}>
                  <div style={{ fontSize: 11, color: muted(50), lineHeight: 1.45 }}>
                    Drag an image straight off the results page, or paste its address below.
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      className="input"
                      value={coverPaste}
                      onChange={(e) => setCoverPaste(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCoverUrl(e.target.value);
                        }
                      }}
                      placeholder="https://…image.jpg"
                    />
                    <button className="btn btn-primary" type="button" onClick={() => addCoverUrl(coverPaste)}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {candidates.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: muted(42),
                        marginBottom: 7,
                      }}
                    >
                      Candidates
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill,minmax(52px,1fr))',
                        gap: 7,
                      }}
                    >
                      {candidates.map((u) => (
                        <button
                          key={u}
                          type="button"
                          title={u}
                          onClick={() => setField('image', u)}
                          style={{
                            padding: 0,
                            border: 0,
                            cursor: 'pointer',
                            aspectRatio: '2/3',
                            borderRadius: 5,
                            overflow: 'hidden',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundColor: 'var(--color-neutral-900)',
                            backgroundImage: `url("${u}")`,
                            boxShadow:
                              u === form.image ? '0 0 0 2px var(--color-accent)' : 'var(--shadow-sm)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="field">
              <label>
                Cover scan URL <span className="text-muted">— blank uses the generated plate</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  value={form.image}
                  onChange={(e) => setField('image', e.target.value)}
                  placeholder="https://…"
                />
                <button
                  className="btn btn-secondary"
                  type="button"
                  title="Clear"
                  onClick={() => setField('image', '')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 9,
              alignItems: 'center',
              flexWrap: 'wrap',
              paddingTop: 2,
            }}
          >
            <button className="btn btn-primary" type="submit">
              <Check size={14} />
              {editingId ? 'Save changes' : 'Add to index'}
            </button>
            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={onCancelEdit}>
                Cancel
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--color-accent-300)', marginLeft: 'auto' }}>
              {flash}
            </span>
          </div>
        </form>

        {/* Inventory */}
        <div style={{ flex: '999 1 540px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <h4 style={{ margin: 0, marginRight: 'auto' }}>Inventory</h4>
            <input
              className="input"
              style={{ width: 'auto', minWidth: 180, height: 34 }}
              placeholder="Filter inventory…"
              value={adminQ}
              onChange={(e) => setAdminQ(e.target.value)}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Issue</th>
                  <th>Publisher</th>
                  <th>Year</th>
                  <th>Grade</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                  <th style={{ width: 88 }}></th>
                </tr>
              </thead>
              <tbody>
                {(inventory?.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <CoverSwatch rec={r} width={24} height={34} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {r.title}
                        {r.variant ? ` · ${r.variant}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: muted(45) }}>
                        {r.keyNote || r.character || r.creators}
                      </div>
                    </td>
                    <td className="text-muted">{r.publisher}</td>
                    <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.year > 0 ? r.year : '—'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.grade > 0 ? r.grade : '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--color-accent-300)',
                      }}
                    >
                      {money(r.price)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-icon btn-ghost"
                          title="Edit"
                          onClick={() => onEdit(r)}
                        >
                          <PencilSimple size={15} />
                        </button>
                        <button
                          className="btn btn-icon btn-ghost"
                          title="Delete"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inventory && inventory.data.length < inventory.meta.total && (
            <div style={{ paddingTop: 14, textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={onShowMore}>
                Show more ({inventory.data.length} of {inventory.meta.total})
              </button>
            </div>
          )}
        </div>
      </div>
      <datalist id="lb-pubs">
        {publishers.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </main>
  );
}
