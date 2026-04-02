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

const LocationModal = ({ location, gps, prefill, onClose, onSave, onDelete, mode, referents = [] }) => {
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isAdd = mode === 'add';

  const [title, setTitle] = useState(prefill?.title || location?.title || '');
  const [address, setAddress] = useState(prefill?.address || location?.address || '');
  const [referent, setReferent] = useState(location?.referent || '');
  const [brochureDeposee, setBrochureDeposee] = useState(!!location?.BrochureDeposee);
  const [addingReferent, setAddingReferent] = useState(false);
  const [newReferentName, setNewReferentName] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    setTitle(prefill?.title || location?.title || '');
    setAddress(prefill?.address || location?.address || '');
    setReferent(location?.referent || '');
    setBrochureDeposee(!!location?.BrochureDeposee);
    setAddingReferent(false);
    setNewReferentName('');
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

  const effectiveReferent = addingReferent ? newReferentName.trim() : referent;

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const saveData = { title: title.trim(), address: address.trim(), referent: effectiveReferent };
      if (location?.Partenaire) saveData.BrochureDeposee = brochureDeposee;
      await onSave(saveData);
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

          {/* Referent */}
          <div className="form-group">
            <label>Référent</label>
            {isView ? (
              <div style={{ fontSize: '0.9rem', color: '#444' }}>{location?.referent || '—'}</div>
            ) : addingReferent ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newReferentName}
                  onChange={(e) => setNewReferentName(e.target.value)}
                  placeholder="Nom du référent"
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => { setAddingReferent(false); setNewReferentName(''); }}
                  style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
                >
                  Annuler
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={referent}
                  onChange={(e) => setReferent(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">— Aucun référent —</option>
                  {referents.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingReferent(true)}
                  className="btn-sm"
                  style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
                >
                  + Nouveau
                </button>
              </div>
            )}
          </div>

          {/* Brochure déposée — partenaires uniquement */}
          {location?.Partenaire && !isAdd && (
            <div className="form-group">
              <label>Statut brochure</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isView ? 'default' : 'pointer', userSelect: 'none' }}>
                <div
                  onClick={() => !isView && setBrochureDeposee(v => !v)}
                  style={{
                    width: '44px', height: '24px',
                    borderRadius: '12px',
                    border: '2px solid #000',
                    backgroundColor: brochureDeposee ? '#4a90d9' : '#ddd',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    flexShrink: 0,
                    cursor: isView ? 'default' : 'pointer',
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '2px solid #000',
                    position: 'absolute',
                    top: '2px',
                    left: brochureDeposee ? '22px' : '2px',
                    transition: 'left 0.2s',
                  }} />
                </div>
                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                  {brochureDeposee ? '✓ Brochure déposée' : 'Brochure non déposée'}
                </span>
              </label>
            </div>
          )}

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
