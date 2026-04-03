import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseGPS, stripGPS } from '../services/api.js';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createIcon = (color = '#8bbfd5') => L.divIcon({
  className: '',
  html: `<div style="
    width: 26px; height: 26px;
    background-color: ${color};
    border: 3px solid #000;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 3px 3px 0px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -28],
});

const defaultIcon = createIcon('#8bbfd5');
const activeIcon = createIcon('#f0c040');
// Partenaire : brochure non déposée → contour noir, fond transparent
const partnerIcon = createIcon('transparent');
// Partenaire : brochure déposée → bleu
const partnerDeposedIcon = createIcon('#4a90d9');

// Component to handle map clicks in add mode
const MapClickHandler = ({ addMode, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (addMode) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
};

// Component to fly to a location
const FlyTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [target, map]);
  return null;
};

// Component to expose map instance via ref
const MapRefSetter = ({ mapRef }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

const Map = ({ locations, addMode, setAddMode, onMapClick, selectedId, onSelectLocation, onEditLocation, flyTarget }) => {
  const mapRef = useRef(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const detectUserLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 18);
        }
        setIsDetectingLocation(false);
      },
      (error) => {
        let errorMessage = "Impossible de détecter votre position.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Vous avez refusé l'accès à votre position.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Les informations de localisation ne sont pas disponibles.";
            break;
          case error.TIMEOUT:
            errorMessage = "La demande de localisation a expiré.";
            break;
        }
        alert(errorMessage);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleToggleAddMode = () => {
    if (!addMode) {
      detectUserLocation();
    }
    setAddMode(!addMode);
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[46.2276, 2.2137]}
        zoom={6}
        style={{ height: '100%', width: '100%', cursor: addMode ? 'crosshair' : 'grab' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRefSetter mapRef={mapRef} />
        <MapClickHandler addMode={addMode} onMapClick={onMapClick} />
        {flyTarget && <FlyTo target={flyTarget} />}

        {locations.map(loc => {
          const gps = parseGPS(loc);
          if (!gps) return null;
          let icon;
          if (loc.Id === selectedId) {
            icon = activeIcon;
          } else if (loc.Partenaire) {
            icon = loc.BrochureDeposee ? partnerDeposedIcon : partnerIcon;
          } else {
            icon = defaultIcon;
          }
          const comments = stripGPS(loc.Comments);

          return (
            <Marker
              key={loc.Id}
              position={[gps.lat, gps.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectLocation(loc.Id)
              }}
            >
              <Popup>
                <div style={{ minWidth: '180px', fontFamily: 'Space Grotesk, sans-serif' }}>
                  <div style={{ fontWeight: '900', fontSize: '1rem', marginBottom: '4px', textTransform: 'uppercase' }}>
                    {loc.title}
                  </div>
                  {loc.address && (
                    <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '8px' }}>
                      {loc.address}
                    </div>
                  )}
                  {comments && (
                    <div style={{
                      fontSize: '0.8rem',
                      backgroundColor: '#f5f5f5',
                      padding: '6px 8px',
                      borderLeft: '3px solid #8bbfd5',
                      marginBottom: '8px',
                      maxHeight: '80px',
                      overflow: 'auto'
                    }}>
                      {comments.split('\n').slice(-2).join('\n')}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      onClick={() => onEditLocation(loc)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        backgroundColor: '#8bbfd5',
                        border: '2px solid #000',
                        boxShadow: '2px 2px 0px #000',
                        cursor: 'pointer',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Bouton + rond flottant (bas droite) */}
      <button
        onClick={handleToggleAddMode}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          zIndex: 1000,
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: addMode ? '#ff4d4d' : 'var(--brutal-ice)',
          border: '3px solid black',
          boxShadow: '4px 4px 0px black',
          fontSize: '2rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          lineHeight: 1,
          transition: 'transform 0.1s'
        }}
        title={addMode ? "Annuler l'ajout" : "Ajouter un lieu"}
      >
        {addMode ? '×' : '+'}
      </button>

      {/* Légende */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '10px',
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '10px 12px',
        border: '2px solid black',
        boxShadow: '3px 3px 0px black',
        fontSize: '0.8rem',
        fontFamily: 'Space Grotesk, sans-serif',
        fontWeight: '600',
      }}>
        {[
          { color: '#8bbfd5', label: 'Lieu standard' },
          { color: 'transparent', label: 'Partenaire (brochure à déposer)', border: true },
          { color: '#4a90d9', label: 'Partenaire (brochure déposée)' },
          { color: '#f0c040', label: 'Sélectionné' },
        ].map(({ color, label, border }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <div style={{
              width: '14px',
              height: '14px',
              backgroundColor: color,
              border: '2px solid #000',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              flexShrink: 0,
            }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip en mode ajout */}
      {addMode && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '30px',
          zIndex: 1000,
          backgroundColor: 'white',
          padding: '10px',
          border: '2px solid black',
          boxShadow: '3px 3px 0px black',
          fontWeight: 'bold',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '220px'
        }}>
          <div style={{ fontSize: '0.9rem' }}>Cliquez sur la carte pour placer le lieu</div>
          <button
            onClick={detectUserLocation}
            disabled={isDetectingLocation}
            style={{
              padding: '8px 12px',
              backgroundColor: isDetectingLocation ? '#ccc' : 'var(--brutal-ice)',
              border: '2px solid black',
              boxShadow: '2px 2px 0px black',
              cursor: isDetectingLocation ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {isDetectingLocation ? '📍 Détection...' : '📍 Me localiser'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Map;
