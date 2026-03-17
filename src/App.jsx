import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login.jsx';
import Map from './components/Map.jsx';
import LocationModal from './components/LocationModal.jsx';
import {
  fetchLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  parseGPS,
  buildComments
} from './services/api.js';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('auth') === 'true'
  );
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [pendingGPS, setPendingGPS] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit'|'view', location: null|obj }
  const [selectedId, setSelectedId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    sessionStorage.setItem('auth', 'true');
    setIsAuthenticated(true);
  };

  const loadLocations = useCallback(async () => {
    setLoading(true);
    const data = await fetchLocations();
    setLocations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadLocations();
  }, [isAuthenticated, loadLocations]);

  const filteredLocations = locations.filter(loc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (loc.title || '').toLowerCase().includes(q) ||
      (loc.address || '').toLowerCase().includes(q)
    );
  });

  const locationsWithGPS = filteredLocations.filter(loc => parseGPS(loc.Comments));
  const locationsWithoutGPS = filteredLocations.filter(loc => !parseGPS(loc.Comments));

  const handleMapClick = (latlng) => {
    if (!addMode) return;
    setPendingGPS(latlng);
    setAddMode(false);
    setModal({ mode: 'add', location: null });
  };

  const handleAddClick = () => {
    setAddMode(true);
    setPanelCollapsed(true);
  };

  const handleSave = async (data, commentOnly = false) => {
    if (modal.mode === 'add') {
      const gpsObj = pendingGPS ? { lat: pendingGPS.lat, lng: pendingGPS.lng } : null;
      const comments = gpsObj ? buildComments(gpsObj, '') : '';
      await createLocation({ title: data.title, address: data.address, Comments: comments });
      setPendingGPS(null);
    } else if (modal.mode === 'edit' || commentOnly) {
      await updateLocation(modal.location.Id, data);
    }
    setModal(null);
    await loadLocations();
  };

  const handleDelete = async (id) => {
    await deleteLocation(id);
    setModal(null);
    setSelectedId(null);
    await loadLocations();
  };

  const handleSelectLocation = (id) => {
    setSelectedId(id);
    const loc = locations.find(l => l.Id === id);
    if (loc) {
      const gps = parseGPS(loc.Comments);
      if (gps) setFlyTarget({ ...gps, _t: Date.now() });
    }
  };

  const handleEditLocation = (loc) => {
    setModal({ mode: 'edit', location: loc });
  };

  const handleListItemClick = (loc) => {
    setSelectedId(loc.Id);
    const gps = parseGPS(loc.Comments);
    if (gps) setFlyTarget({ ...gps, _t: Date.now() });
    setModal({ mode: 'edit', location: loc });
  };

  const closeModal = () => {
    setModal(null);
    setPendingGPS(null);
  };

  const cancelAddMode = () => {
    setAddMode(false);
    setPendingGPS(null);
    setPanelCollapsed(false);
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const totalWithGPS = locations.filter(l => parseGPS(l.Comments)).length;

  return (
    <div className="app-container">
      {/* Mobile top bar */}
      <div className="top-bar">
        <h1>Dépôt Brochures</h1>
        <div className="top-bar-actions">
          {addMode ? (
            <button onClick={cancelAddMode} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#ffb3b3' }}>
              Annuler
            </button>
          ) : (
            <button onClick={handleAddClick} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              + Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className={`map-wrapper${addMode ? ' add-mode' : ''}`}>
        {addMode && (
          <div className="add-mode-banner">
            Cliquez sur la carte pour placer le lieu
            <button
              onClick={cancelAddMode}
              style={{
                marginLeft: '12px',
                padding: '2px 10px',
                fontSize: '0.75rem',
                backgroundColor: 'var(--brutal-white)',
                color: 'var(--brutal-black)'
              }}
            >
              Annuler
            </button>
          </div>
        )}
        <Map
          locations={filteredLocations}
          addMode={addMode}
          onMapClick={handleMapClick}
          selectedId={selectedId}
          onSelectLocation={handleSelectLocation}
          onEditLocation={handleEditLocation}
          flyTarget={flyTarget}
        />
      </div>

      {/* Sidebar / bottom panel */}
      <div className={`bottom-panel${panelCollapsed ? ' collapsed' : ''}`}>
        {/* Desktop-only title */}
        <div className="desktop-sidebar-header">
          <h1>Dépôt Brochures</h1>
          {!addMode && (
            <button onClick={handleAddClick} className="btn-sm btn-primary" style={{ padding: '6px 12px' }}>
              + Ajouter
            </button>
          )}
        </div>

        <div className="panel-header">
          <h2>
            {loading ? 'Chargement...' : `${totalWithGPS} lieu${totalWithGPS !== 1 ? 'x' : ''} recensé${totalWithGPS !== 1 ? 's' : ''}`}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!panelCollapsed && !addMode && (
              <button
                onClick={handleAddClick}
                className="btn-sm btn-primary"
                style={{ padding: '6px 12px' }}
              >
                + Ajouter
              </button>
            )}
            <button
              className="panel-toggle"
              onClick={() => setPanelCollapsed(v => !v)}
              title={panelCollapsed ? 'Afficher la liste' : 'Réduire'}
            >
              {panelCollapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {!panelCollapsed && (
          <>
            <div className="search-box">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un lieu..."
              />
            </div>

            <div className="location-list">
              {filteredLocations.length === 0 && (
                <div className="empty-state">
                  {search ? 'Aucun résultat' : 'Aucun lieu enregistré'}
                </div>
              )}

              {locationsWithGPS.map(loc => (
                <div
                  key={loc.Id}
                  className={`location-item${selectedId === loc.Id ? ' active' : ''}`}
                  onClick={() => handleListItemClick(loc)}
                >
                  <div className="location-dot" />
                  <div className="location-info">
                    <div className="location-name">{loc.title}</div>
                    {loc.address && <div className="location-address">{loc.address}</div>}
                  </div>
                </div>
              ))}

              {locationsWithoutGPS.length > 0 && (
                <>
                  {locationsWithGPS.length > 0 && (
                    <div style={{
                      padding: '8px 16px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      color: '#888',
                      borderTop: '2px solid var(--brutal-bg)',
                      backgroundColor: 'var(--brutal-bg)'
                    }}>
                      Sans position GPS
                    </div>
                  )}
                  {locationsWithoutGPS.map(loc => (
                    <div
                      key={loc.Id}
                      className={`location-item no-gps${selectedId === loc.Id ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedId(loc.Id);
                        setModal({ mode: 'edit', location: loc });
                      }}
                    >
                      <div className="location-dot" />
                      <div className="location-info">
                        <div className="location-name">{loc.title}</div>
                        {loc.address && <div className="location-address">{loc.address}</div>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <LocationModal
          mode={modal.mode}
          location={modal.location}
          gps={pendingGPS}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default App;
