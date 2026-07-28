import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Header from './components/Header.jsx';
import Catalog from './components/Catalog.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import Cms from './components/Cms.jsx';

const emptyForm = () => ({
  series: '',
  issue: '',
  publisher: '',
  character: '',
  variant: '',
  year: '',
  coverDate: '',
  genre: 'Superhero',
  grade: '',
  price: '',
  creators: '',
  keyNote: '',
  summary: '',
  image: '',
});

const defaultFilters = () => ({
  q: '',
  pub: [],
  era: [],
  genre: [],
  keyOnly: false,
  priceCap: 100,
  sort: 'value-desc',
  layout: 'wall',
});

const PAGE = 60;
const INV_PAGE = 40;

export default function App() {
  const [view, setView] = useState('catalog');

  // Catalog state — search, facets and sort resolve server-side;
  // the wall/ledger shows one numbered page at a time.
  const [filters, setFilters] = useState(defaultFilters());
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState(null);
  const pendingOpen = useRef(null); // 'first' | 'last' after a drawer page-cross
  const [settings, setSettings] = useState(null);

  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  // CMS state
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [flash, setFlashText] = useState('');
  const [adminQ, setAdminQ] = useState('');
  const [inventory, setInventory] = useState(null);
  const [summary, setSummary] = useState({ state: 'idle', text: null });
  const [valueLoading, setValueLoading] = useState(false);

  const [refresh, setRefresh] = useState(0);
  const flashTimer = useRef(null);

  const setFlash = useCallback((msg) => {
    setFlashText(msg);
    clearTimeout(flashTimer.current);
    if (msg) flashTimer.current = setTimeout(() => setFlashText(''), 2600);
  }, []);

  // Chrome data
  useEffect(() => {
    api.meta().then(setMeta).catch(console.error);
    api.settings().then(setSettings).catch(console.error);
  }, []);
  useEffect(() => {
    if (settings?.siteTitle) {
      document.title = `${settings.siteTitle} — ${settings.siteTagline || 'Archive & Index'}`;
    }
  }, [settings]);
  useEffect(() => {
    api.stats().then(setStats).catch(console.error);
  }, [refresh]);

  // Filter changes restart from page one.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Catalog search — debounced so typing and the ceiling slider stay live.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ ...filters, limit: PAGE, offset: (page - 1) * PAGE })
        .then((res) => {
          setCatalog(res);
          // Drawer page-crossing: open the first/last record of the new page
          if (pendingOpen.current && res.data.length) {
            const rec =
              pendingOpen.current === 'last'
                ? res.data[res.data.length - 1]
                : res.data[0];
            setSelectedId(rec.id);
          }
          pendingOpen.current = null;
        })
        .catch(console.error);
    }, 180);
    return () => clearTimeout(t);
  }, [filters, page, refresh]);

  const totalPages = catalog ? Math.max(1, Math.ceil(catalog.meta.total / PAGE)) : 1;

  // Prev/next navigation from the record drawer, crossing pages when needed.
  const drawerStep = (dir) => {
    if (!catalog || !selectedId) return;
    const idx = catalog.data.findIndex((r) => r.id === selectedId);
    if (idx === -1) return;
    const next = idx + dir;
    if (next >= 0 && next < catalog.data.length) {
      setSelectedId(catalog.data[next].id);
    } else if (dir > 0 && page < totalPages) {
      pendingOpen.current = 'first';
      setPage(page + 1);
    } else if (dir < 0 && page > 1) {
      pendingOpen.current = 'last';
      setPage(page - 1);
    }
  };
  const drawerPosition = (() => {
    if (!catalog || !selectedId) return null;
    const idx = catalog.data.findIndex((r) => r.id === selectedId);
    if (idx === -1) return null;
    const globalIndex = (page - 1) * PAGE + idx + 1;
    return {
      index: globalIndex,
      total: catalog.meta.total,
      hasPrev: globalIndex > 1,
      hasNext: globalIndex < catalog.meta.total,
    };
  })();

  // CMS inventory — most recent first, same accumulating pagination.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ q: adminQ, sort: 'added-desc', limit: INV_PAGE, offset: 0 })
        .then(setInventory)
        .catch(console.error);
    }, 180);
    return () => clearTimeout(t);
  }, [adminQ, refresh]);

  const loadMoreInventory = async () => {
    if (!inventory) return;
    const res = await api.search({
      q: adminQ,
      sort: 'added-desc',
      limit: INV_PAGE,
      offset: inventory.data.length,
    });
    setInventory((v) => ({ ...res, data: [...v.data, ...res.data] }));
  };

  // Record detail (includes census)
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let live = true;
    api
      .get(selectedId)
      .then((rec) => live && setSelected(rec))
      .catch(() => live && setSelectedId(null));
    return () => {
      live = false;
    };
  }, [selectedId]);

  // Market value for the open record — unvalued books get a labeled
  // estimate from live eBay listings, computed and cached server-side.
  useEffect(() => {
    if (!selected || selected.price > 0) {
      setValueLoading(false);
      return;
    }
    let live = true;
    setValueLoading(true);
    api
      .value(selected.id)
      .then((v) => {
        if (!live) return;
        if (v.price > 0) {
          setSelected((prev) =>
            prev && prev.id === v.id
              ? { ...prev, price: v.price, priceSource: v.priceSource, priceNote: v.priceNote }
              : prev
          );
        }
      })
      .catch(() => {})
      .finally(() => live && setValueLoading(false));
    return () => {
      live = false;
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Synopsis for the open record — cached ones arrive with the record;
  // otherwise fetched (and persisted server-side) on first open.
  useEffect(() => {
    if (!selected) {
      setSummary({ state: 'idle', text: null });
      return;
    }
    if (selected.summary) {
      setSummary({ state: 'done', text: selected.summary });
      return;
    }
    let live = true;
    setSummary({ state: 'loading', text: null });
    api
      .summary(selected.id)
      .then((r) => live && setSummary({ state: 'done', text: r.summary }))
      .catch(() => live && setSummary({ state: 'done', text: null }));
    return () => {
      live = false;
    };
  }, [selected]);

  const clearAll = () =>
    setFilters((f) => ({
      ...f,
      q: '',
      pub: [],
      era: [],
      genre: [],
      keyOnly: false,
      priceCap: 100,
    }));

  const setField = (key, value, flashMsg) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (flashMsg) setFlash(flashMsg);
  };

  const startEdit = (rec) => {
    setView('admin');
    setSelectedId(null);
    setEditingId(rec.id);
    setFlash('');
    setForm({
      series: rec.series,
      issue: String(rec.issue),
      publisher: rec.publisher,
      character: rec.character || '',
      variant: rec.variant || '',
      year: rec.year > 0 ? String(rec.year) : '',
      coverDate: rec.coverDate || '',
      genre: rec.genre,
      grade: rec.grade > 0 ? String(rec.grade) : '',
      price: rec.price > 0 ? String(rec.price) : '',
      creators: rec.creators,
      keyNote: rec.keyNote,
      summary: rec.summary || '',
      image: rec.image,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.series.trim()) {
      setFlash('Series is required');
      return;
    }
    try {
      if (editingId) {
        await api.update(editingId, form);
        setFlash('Record updated');
      } else {
        await api.create(form);
        setFlash('Added to the index');
      }
      setForm(emptyForm());
      setEditingId(null);
      setRefresh((n) => n + 1);
    } catch (err) {
      setFlash(err.message);
    }
  };

  const onDelete = async (id) => {
    try {
      await api.remove(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
      setRefresh((n) => n + 1);
    } catch (err) {
      setFlash(err.message);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 60% at 12% -10%, #1e2136 0%, #161826 55%, #131522 100%)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Header
        view={view}
        setView={setView}
        q={filters.q}
        setQ={(q) => setFilters((f) => ({ ...f, q }))}
        settings={settings}
      />

      {view === 'catalog' && (
        <Catalog
          catalog={catalog}
          stats={stats}
          ticker={meta?.ticker ?? []}
          filters={filters}
          setFilters={setFilters}
          clearAll={clearAll}
          openRecord={setSelectedId}
          page={page}
          totalPages={totalPages}
          onPage={setPage}
        />
      )}

      {view === 'admin' && (
        <Cms
          stats={stats}
          genres={meta?.genres ?? []}
          publishers={meta?.publishers ?? []}
          form={form}
          setField={setField}
          editingId={editingId}
          flash={flash}
          onSubmit={submit}
          onCancelEdit={() => {
            setEditingId(null);
            setForm(emptyForm());
            setFlash('');
          }}
          inventory={inventory}
          adminQ={adminQ}
          setAdminQ={setAdminQ}
          onEdit={startEdit}
          onDelete={onDelete}
          onShowMore={loadMoreInventory}
          uploadCover={api.uploadCover}
          settings={settings}
          onSaveSettings={async (patch) => {
            try {
              setSettings(await api.saveSettings(patch));
              setFlash('Site settings saved');
            } catch (err) {
              setFlash(err.message);
            }
          }}
        />
      )}

      <footer
        style={{
          maxWidth: 1580,
          margin: '0 auto',
          padding: '0 clamp(14px,3vw,34px) 28px',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'color-mix(in srgb, var(--color-text) 32%, transparent)',
        }}
      >
        Cover imagery via{' '}
        <a href="https://comicvine.gamespot.com" target="_blank" rel="noopener noreferrer">
          Comic Vine
        </a>
      </footer>

      <DetailPanel
        sel={selected}
        summary={summary}
        valueLoading={valueLoading}
        position={drawerPosition}
        onStep={drawerStep}
        onClose={() => setSelectedId(null)}
        onEdit={startEdit}
      />
    </div>
  );
}
