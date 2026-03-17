import React, { useState, useEffect } from 'react';
import { stripGPS, addComment, reverseGeocode } from '../services/api.js';

// Parse individual comments from the comments string
const parseComments = (comments) => {
  const stripped = stripGPS(comments);
  if (!stripped) return [];
  return stripped.split('\n').filter(line => line.trim()).map(line => {
    const match = line.match(/^\[(.+?)\] (.+)$/);
    if (match) return { timestamp: match[1], text: match[2] };
    return { timestamp: null, text: line };
  });
};

const LocationModal = ({ location, gps, prefill, onClose, onSave, onDelete, mode }) => {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isAdd = mode === 'add';

  const [title, setTitle] = useState(prefill?.title || location?.title || '');
  const [address, setAddress] = useState(prefill?.address || location?.address || '');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    setTitle(prefill?.title || location?.title || '');
    setAddress(prefill?.address || location?.address || '');
    setNewComment('');
    setConfirmDelete(false);
  }, [location, prefill]);

  // Reverse geocoding si pas d'adresse pré-remplie (entrée manuelle)
  useEffect(() => {
    if (gps && isAdd && !prefill?.address) {
      setIsGeocoding(true);
      reverseGeocode(gps.lat, gps.lng).then(addr => {
        if (addr) setAddress(addr);
        setIsGeocoding(false);
      });
    }
  }, [gps, isAdd, prefill]);

  const comments = parseComments(location?.Comments);

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSave({ title: title.trim(), address: address.trim() });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const updatedComments = addComment(location?.Comments || '', newComment.trim());
      await onSave({ Comments: updatedComments }, true);
      setNewComment('');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      await onDelete(location.Id);
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = isEdit ? 'Modifier le lieu' : isView ? 'Détails du lieu' : 'Nouveau lieu de dépôt';
  const effectiveGps = prefill?.gps || gps;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{modalTitle}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* GPS info */}
          {effectiveGps && !isView && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'var(--brutal-green)',
              border: '2px solid var(--brutal-black)',
              fontSize: '0.8rem',
              fontWeight: '700'
            }}>
              📍 Position : {effectiveGps.lat.toFixed(5)}, {effectiveGps.lng.toFixed(5)}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label>Nom du lieu *</label>
            {isView ? (
              <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{location?.title}</div>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Bibliothèque du Centre"
                autoFocus={!isView}
              />
            )}
          </div>

          {/* Address */}
          <div className="form-group">
            <label>
              Adresse
              {isGeocoding && (
                <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#888', fontWeight: 'normal' }}>
                  Récupération en cours...
                </span>
              )}
            </label>
            {isView ? (
              <div style={{ fontSize: '0.9rem', color: '#444' }}>{location?.address || '—'}</div>
            ) : (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: 12 rue de la Mairie, 74800..."
              />
            )}
          </div>

          {/* Comments (view/edit mode) */}
          {(isView || isEdit) && (
            <div className="comments-section">
              <div style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '10px' }}>
                Commentaires
              </div>
              {comments.length === 0 && (
                <div style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '10px' }}>
                  Aucun commentaire
                </div>
              )}
              {comments.map((c, i) => (
                <div key={i} className="comment-entry">
                  {c.timestamp && <div className="comment-timestamp">{c.timestamp}</div>}
                  <div>{c.text}</div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Ajouter un commentaire..."
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || loading}
                  className="btn-sm btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '8px 12px' }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isAdd && (
            <>
              <button onClick={onClose} style={{ flex: '0 0 auto', padding: '12px 20px' }}>
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || loading}
                className="btn-primary"
                style={{ flex: 1, padding: '12px' }}
              >
                {loading ? '...' : 'Enregistrer'}
              </button>
            </>
          )}

          {isEdit && (
            <>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="btn-danger"
                style={{ flex: '0 0 auto', padding: '12px 16px' }}
              >
                {confirmDelete ? 'Confirmer ?' : 'Supprimer'}
              </button>
              <button onClick={onClose} style={{ flex: '0 0 auto', padding: '12px 16px' }}>
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || loading}
                className="btn-primary"
                style={{ flex: 1, padding: '12px' }}
              >
                {loading ? '...' : 'Sauvegarder'}
              </button>
            </>
          )}

          {isView && (
            <button onClick={onClose} style={{ flex: 1, padding: '12px' }}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
