import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import MapComponent from './components/Map';
import Sidebar from './components/Sidebar';
import EntityDetails from './pages/EntityDetails';
import History from './pages/History';
import Dashboard from './pages/Dashboard';
import SuiviAvancement from './pages/SuiviAvancement';
import BilanFinancier from './pages/BilanFinancier';
import Login from './components/Login';
import BrochureAdmin from './pages/BrochureAdmin';
import { fetchEntities } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'USER' or 'ADMIN'
  const [entities, setEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [filters, setFilters] = useState({
    Statuts: '',
    Type: '',
    Referent: '',
    Search: ''
  });

  // Check if user is already authenticated (session storage)
  useEffect(() => {
    const authStatus = sessionStorage.getItem('isAuthenticated');
    const storedRole = sessionStorage.getItem('userRole');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      setUserRole(storedRole || 'USER'); // Default to USER for backward compatibility
    }
  }, []);

  const handleLogin = (role = 'USER') => {
    setIsAuthenticated(true);
    setUserRole(role);
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('userRole', role);
  };

  const loadData = async () => {
    const data = await fetchEntities();
    console.log('Loaded entities:', data);
    setEntities(data);
    setFilteredEntities(data);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let result = entities;

    if (filters.Statuts) {
      result = result.filter(e => e.Statuts === filters.Statuts);
    }
    if (filters.Type) {
      result = result.filter(e => e.Type === filters.Type);
    }
    if (filters.Referent) {
      if (filters.Referent === 'Non attribué') {
        result = result.filter(e => !e.Référent_partenariat_club);
      } else {
        result = result.filter(e => e.Référent_partenariat_club === filters.Referent);
      }
    }
    if (filters.Search) {
      const searchLower = filters.Search.toLowerCase();
      result = result.filter(e =>
        (e.title && e.title.toLowerCase().includes(searchLower)) ||
        (e.address && e.address.toLowerCase().includes(searchLower)) ||
        (e.Place && e.Place.toLowerCase().includes(searchLower)) // Search in Google Maps URL too just in case
      );
    }

    setFilteredEntities(result);
  }, [filters, entities]);

  const [newLocation, setNewLocation] = useState(null); // { lat, lng }
  const [isAddMode, setIsAddMode] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isMapHidden, setIsMapHidden] = useState(false);

  const handleMapClick = (lat, lng) => {
    setNewLocation({ lat, lng });
    // Optionally open the sidebar modal if not open, but for now just set state
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="app-container">
            <div className={`sidebar ${isSidebarHidden ? 'sidebar-hidden' : ''} ${isMapHidden ? 'full-width' : ''}`}>
              <Sidebar
                filters={filters}
                setFilters={setFilters}
                entities={entities}
                refreshEntities={loadData}
                newLocation={newLocation}
                setNewLocation={setNewLocation}
                setIsAddMode={setIsAddMode}
                isMapHidden={isMapHidden}
                setIsMapHidden={setIsMapHidden}
                setIsSidebarHidden={setIsSidebarHidden}
                userRole={userRole}
              />
            </div>
            <div className={`map-container ${isSidebarHidden ? 'map-fullscreen' : ''} ${isMapHidden ? 'map-hidden' : ''}`}>
              <MapComponent
                entities={filteredEntities}
                onMapClick={handleMapClick}
                newLocation={newLocation}
                isAddMode={isAddMode}
                setIsAddMode={setIsAddMode}
                refreshEntities={loadData}
                setIsSidebarHidden={setIsSidebarHidden}
              />
            </div>
          </div>
        } />
        <Route path="/entity/:id" element={<EntityDetails entities={entities} refreshEntities={loadData} userRole={userRole} />} />
        <Route path="/history" element={<History />} />
        <Route path="/dashboard" element={<Dashboard entities={entities} />} />
        <Route path="/suivi" element={<SuiviAvancement entities={entities} userRole={userRole} />} />
        <Route path="/bilan" element={<BilanFinancier entities={entities} />} />
        <Route path="/brochure-admin" element={<BrochureAdmin />} />
      </Routes>
    </Router>
  );
}

export default App;
