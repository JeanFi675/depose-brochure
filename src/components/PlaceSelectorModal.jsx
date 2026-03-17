import React, { useEffect, useState } from 'react';
import { fetchNearbyPlaces, reverseGeocode } from '../services/api.js';

const formatPlaceType = (tags) =>
  tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.craft || tags.office || 'Lieu';

const PlaceSelectorModal = ({ gps, onSelectPlace, onManual, onCancel }) => {
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gps) return;
    setIsLoading(true);
    fetchNearbyPlaces(gps.lat, gps.lng).then(results => {
      setPlaces(results);
      setIsLoading(false);
    });
  }, [gps]);

  const handleSelect = async (place) => {
    const lat = place.lat || place.center?.lat;
    const lon = place.lon || place.center?.lon;
    const address = (lat && lon) ? await reverseGeocode(lat, lon) : '';
    onSelectPlace({
      title: place.tags.name || '',
      address,
      gps: (lat && lon) ? { lat, lng: lon } : gps
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>🏪 Lieux à proximité</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.9rem', color: '#555', margin: '0 0 12px' }}>
            📍 {gps?.lat.toFixed(5)}, {gps?.lng.toFixed(5)}
          </p>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontSize: '0.9rem' }}>
              Recherche des lieux à proximité...
            </div>
          ) : places.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '0.9rem' }}>
              Aucun lieu trouvé dans un rayon de 50m.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
              {places.map((place, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(place)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    backgroundColor: '#fff',
                    border: '2px solid #ddd',
                    boxShadow: '2px 2px 0px #ddd',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'border-color 0.1s'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = '#000'}
                  onMouseOut={e => e.currentTarget.style.borderColor = '#ddd'}
                >
                  <div style={{ fontWeight: '700' }}>{place.tags.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px', textTransform: 'capitalize' }}>
                    {formatPlaceType(place.tags)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} style={{ flex: '0 0 auto', padding: '12px 16px' }}>
            Annuler
          </button>
          <button
            onClick={onManual}
            className="btn-primary"
            style={{ flex: 1, padding: '12px' }}
          >
            Ce lieu n'est pas dans la liste
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlaceSelectorModal;
