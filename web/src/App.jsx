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
  genre: 'Superhero',
  grade: '',
  price: '',
  creators: '',
  keyNote: '',
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

  // Catalog state — search, facets and sort resolve server-side.
  const [filters, setFilters] = useState(defaultFilters());
  const [catLimit, setCatLimit] = useState(PAGE);
  const [catalog, setCatalog] = useState(null);

  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  // CMS state
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [flash, setFlashText] = useState('');
  const [adminQ, setAdminQ] = useState('');
  const [invLimit, setInvLimit] = useState(INV_PAGE);
  const [inventory, setInventory] = useState(null);

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
  }, []);
  useEffect(() => {
    api.stats().then(setStats).catch(console.error);
  }, [refresh]);

  // Catalog search — debounced so typing and the ceiling slider stay live.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ ...filters, limit: catLimit })
        .then(setCatalog)
        .catch(console.error);
    }, 180);
    return () => clearTimeout(t);
  }, [filters, catLimit, refresh]);

  // CMS inventory — most recent first, paginated.
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .search({ q: adminQ, sort: 'added-desc', limit: invLimit })
        .then(setInventory)
        .catch(console.error);
    }, 180);
    return () => clearTimeout(t);
  }, [adminQ, invLimit, refresh]);

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
      genre: rec.genre,
      grade: rec.grade > 0 ? String(rec.grade) : '',
      price: rec.price > 0 ? String(rec.price) : '',
      creators: rec.creators,
      keyNote: rec.keyNote,
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
          loadMore={() => setCatLimit((n) => Math.min(200, n + PAGE))}
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
          onShowMore={() => setInvLimit((n) => Math.min(200, n + INV_PAGE))}
          uploadCover={api.uploadCover}
        />
      )}

      <DetailPanel sel={selected} onClose={() => setSelectedId(null)} onEdit={startEdit} />
    </div>
  );
}
