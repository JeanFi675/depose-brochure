import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login.jsx';
import Map from './components/Map.jsx';
import LocationModal from './components/LocationModal.jsx';
import PlaceSelectorModal from './components/PlaceSelectorModal.jsx';
import {
  fetchLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  parseGPS,
  addComment
} from './services/api.js';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('auth') === 'true'
  );
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [pendingGPS, setPendingGPS] = useState(null);
  // Étape 1 : sélecteur de POI  |  Étape 2 : formulaire
  const [showPlaceSelector, setShowPlaceSelector] = useState(false);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit'|'view', location: null|obj }
  const [prefill, setPrefill] = useState(null); // { title, address, gps } depuis POI sélectionné
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

  const locationsWithGPS = filteredLocations.filter(loc => parseGPS(loc));
  const locationsWithoutGPS = filteredLocations.filter(loc => !parseGPS(loc));

  // Clic sur la carte → étape 1 : sélecteur de POI
  const handleMapClick = (latlng) => {
    if (!addMode) return;
    setPendingGPS(latlng);
    setAddMode(false);
    setPrefill(null);
    setShowPlaceSelector(true);
  };

  // Étape 1 → l'utilisateur sélectionne un POI
  const handleSelectPlace = (placeData) => {
    setShowPlaceSelector(false);
    setPrefill(placeData); // { title, address, gps }
    setModal({ mode: 'add', location: null });
  };

  // Étape 1 → l'utilisateur clique "pas dans la liste"
  const handleManualEntry = () => {
    setShowPlaceSelector(false);
    setPrefill(null);
    setModal({ mode: 'add', location: null });
  };

  // Annulation de l'étape 1
  const handleCancelPlaceSelector = () => {
    setShowPlaceSelector(false);
    setPendingGPS(null);
  };

  const handleSave = async (data, commentOnly = false) => {
    if (modal.mode === 'add') {
      const effectiveGps = prefill?.gps || pendingGPS;
      const gpsStr = effectiveGps
        ? `${effectiveGps.lat.toFixed(6)};${effectiveGps.lng.toFixed(6)}`
        : undefined;
      const now = new Date();
      const timestamp = now.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      await createLocation({
        title: data.title,
        address: data.address,
        gps: gpsStr,
        Comments: `[${timestamp}] Création du lieu`
      });
      setPendingGPS(null);
      setPrefill(null);
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
      const gps = parseGPS(loc);
      if (gps) setFlyTarget({ ...gps, _t: Date.now() });
    }
  };

  const handleEditLocation = (loc) => {
    setModal({ mode: 'edit', location: loc });
  };

  const handleListItemClick = (loc) => {
    setSelectedId(loc.Id);
    const gps = parseGPS(loc);
    if (gps) setFlyTarget({ ...gps, _t: Date.now() });
    setModal({ mode: 'edit', location: loc });
  };

  const closeModal = () => {
    setModal(null);
    setPendingGPS(null);
    setPrefill(null);
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const totalWithGPS = locations.filter(l => parseGPS(l)).length;

  return (
    <div className="app-container">
      {/* Mobile top bar */}
      <div className="top-bar">
        <h1>Dépôt Brochures</h1>
      </div>

      {/* Map */}
      <div className={`map-wrapper${addMode ? ' add-mode' : ''}`}>
        <Map
          locations={filteredLocations}
          addMode={addMode}
          setAddMode={setAddMode}
          onMapClick={handleMapClick}
          selectedId={selectedId}
          onSelectLocation={handleSelectLocation}
          onEditLocation={handleEditLocation}
          flyTarget={flyTarget}
        />
      </div>

      {/* Sidebar / bottom panel */}
      <div className={`bottom-panel${panelCollapsed ? ' collapsed' : ''}`}>
        <div className="desktop-sidebar-header">
          <h1>Dépôt Brochures</h1>
        </div>

        <div className="panel-header">
          <h2>
            {loading ? 'Chargement...' : `${totalWithGPS} lieu${totalWithGPS !== 1 ? 'x' : ''} recensé${totalWithGPS !== 1 ? 's' : ''}`}
          </h2>
          <button
            className="panel-toggle"
            onClick={() => setPanelCollapsed(v => !v)}
            title={panelCollapsed ? 'Afficher la liste' : 'Réduire'}
          >
            {panelCollapsed ? '▲' : '▼'}
          </button>
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

      {/* Étape 1 : sélecteur de POI */}
      {showPlaceSelector && (
        <PlaceSelectorModal
          gps={pendingGPS}
          onSelectPlace={handleSelectPlace}
          onManual={handleManualEntry}
          onCancel={handleCancelPlaceSelector}
        />
      )}

      {/* Étape 2 : formulaire */}
      {modal && (
        <LocationModal
          mode={modal.mode}
          location={modal.location}
          gps={pendingGPS}
          prefill={prefill}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default App;
