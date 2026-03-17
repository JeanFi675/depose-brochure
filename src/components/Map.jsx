import React, { useEffect, useRef } from 'react';
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

const Map = ({ locations, addMode, onMapClick, selectedId, onSelectLocation, onEditLocation, flyTarget }) => {
  return (
    <MapContainer
      center={[46.2276, 2.2137]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler addMode={addMode} onMapClick={onMapClick} />
      {flyTarget && <FlyTo target={flyTarget} />}

      {locations.map(loc => {
        const gps = parseGPS(loc.Comments);
        if (!gps) return null;
        const icon = loc.Id === selectedId ? activeIcon : defaultIcon;
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
  );
};

export default Map;
