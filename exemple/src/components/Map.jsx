import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ReactDOM from 'react-dom';
import { updateEntity } from '../services/api';

// Custom Neo-brutalist Marker Icons
const createCustomIcon = (status, isAssigned) => {
    const backgroundColor = isAssigned ? '#8bbfd5' : '#ffffff'; // Ice if assigned, White if not
    let borderColor = '#000000'; // Default black

    // Color logic based on status for BORDER and SHADOW
    switch (status) {
        case 'À contacter':
        case 'Sans réponse':
            borderColor = '#FFA500'; // Orange
            break;
        case 'En discussion':
            borderColor = '#3b82f6'; // Blue
            break;
        case 'Confirmé (en attente de paiement)':
        case 'Paiement effectué':
            borderColor = '#4ade80'; // Green (same as assigned background, might need contrast check or distinct shade)
            // If background is green (assigned) and border is green (confirmed), it might look solid green.
            // Let's keep it consistent with user request.
            break;
        case 'Refusé':
            borderColor = '#ef4444'; // Red
            break;
        default:
            borderColor = '#000000';
    }

    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
      background-color: ${backgroundColor};
      width: 20px;
      height: 20px;
      border: 3px solid ${borderColor};
      box-shadow: 3px 3px 0px ${borderColor};
      transform: rotate(45deg);
    "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10]
    });
};

// Component to handle map events
const MapEvents = ({ onMapClick, isAddMode }) => {
    useMapEvents({
        click(e) {
            if (isAddMode) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },
        contextmenu(e) {
            if (isAddMode) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        }
    });
    return null;
};

const MapComponent = ({ entities, onMapClick, newLocation, isAddMode, setIsAddMode, refreshEntities, setIsSidebarHidden }) => {
    // Center on Saint-Pierre-en-Faucigny
    const position = [46.0608, 6.3725];
    const mapRef = useRef(null);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignEntity, setAssignEntity] = useState(null);
    const [selectedReferent, setSelectedReferent] = useState('');
    const [newReferent, setNewReferent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    // Comment Modal State
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [commentEntity, setCommentEntity] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Extract unique referents for the dropdown
    const referentOptions = [...new Set(entities.map(e => e.Référent_partenariat_club).filter(Boolean))];

    const detectUserLocation = () => {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Center map on user's location with high zoom
                if (mapRef.current) {
                    mapRef.current.setView([latitude, longitude], 18);
                }
                setIsDetectingLocation(false);
            },
            (error) => {
                console.error('Geolocation error:', error);
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
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const toggleAddMode = () => {
        if (!isAddMode) {
            // Entering add mode - detect user location
            detectUserLocation();

            // Hide sidebar on mobile for better map visibility
            if (setIsSidebarHidden && window.innerWidth <= 768) {
                setIsSidebarHidden(true);
            }
        } else {
            // Exiting add mode - show sidebar again on mobile
            if (setIsSidebarHidden && window.innerWidth <= 768) {
                setIsSidebarHidden(false);
            }
        }
        setIsAddMode(!isAddMode);
    };

    const handleOpenAssignModal = (entity) => {
        setAssignEntity(entity);
        setSelectedReferent('');
        setNewReferent('');
        setShowAssignModal(true);
    };

    const handleCloseAssignModal = () => {
        setShowAssignModal(false);
        setAssignEntity(null);
    };

    const handleAssign = async () => {
        const referentToAssign = newReferent.trim() || selectedReferent;

        if (!referentToAssign) {
            alert("Veuillez sélectionner ou saisir un référent.");
            return;
        }

        setIsSubmitting(true);
        try {
            await updateEntity(assignEntity.Id, { Référent_partenariat_club: referentToAssign });
            alert(`Lieu attribué à ${referentToAssign} !`);
            if (refreshEntities) await refreshEntities();
            handleCloseAssignModal();
        } catch (error) {
            console.error("Erreur lors de l'attribution:", error);
            alert("Erreur lors de l'attribution.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Comment Handlers
    const handleOpenCommentModal = (entity) => {
        setCommentEntity(entity);
        setNewComment('');
        setShowCommentModal(true);
    };

    const handleCloseCommentModal = () => {
        setShowCommentModal(false);
        setCommentEntity(null);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) {
            alert('Veuillez saisir un commentaire.');
            return;
        }

        setIsSubmittingComment(true);
        try {
            const now = new Date();
            const timestamp = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            const formattedComment = `[${timestamp}] ${newComment.trim()}`;

            const existingComments = commentEntity.Comments || '';
            const updatedComments = existingComments
                ? `${existingComments}\n${formattedComment}`
                : formattedComment;

            await updateEntity(commentEntity.Id, { Comments: updatedComments });
            alert('Commentaire ajouté !');
            if (refreshEntities) await refreshEntities();
            handleCloseCommentModal();
        } catch (error) {
            console.error("Erreur lors de l'ajout du commentaire:", error);
            alert("Erreur lors de l'ajout du commentaire.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', border: 'var(--brutal-border)', boxShadow: 'var(--brutal-shadow)', position: 'relative' }}>
            <MapContainer
                center={position}
                zoom={12}
                maxZoom={28}
                style={{ height: '100%', width: '100%', cursor: isAddMode ? 'crosshair' : 'grab' }}
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={28}
                    maxNativeZoom={19}
                />
                <MapEvents onMapClick={(lat, lng) => {
                    onMapClick(lat, lng);
                    setIsAddMode(false); // Exit add mode after picking
                    // Restore sidebar on mobile
                    if (setIsSidebarHidden && window.innerWidth <= 768) {
                        setIsSidebarHidden(false);
                    }
                }} isAddMode={isAddMode} />

                {newLocation && (
                    <Marker
                        position={[newLocation.lat, newLocation.lng]}
                        icon={createCustomIcon('default', false)}
                    >
                        <Popup>Nouveau lieu sélectionné</Popup>
                    </Marker>
                )}

                {entities.map((entity) => {
                    // Extract coordinates
                    let lat, lng;

                    if (entity.gps) {
                        const parts = entity.gps.split(';');
                        if (parts.length === 2) {
                            lat = parseFloat(parts[0]);
                            lng = parseFloat(parts[1]);
                        } else {
                            const partsComma = entity.gps.split(',');
                            if (partsComma.length === 2) {
                                lat = parseFloat(partsComma[0]);
                                lng = parseFloat(partsComma[1]);
                            }
                        }
                    }

                    if (!lat && !lng && entity.Place) {
                        const latMatch = entity.Place.match(/!3d(-?\d+\.\d+)/);
                        const lngMatch = entity.Place.match(/!4d(-?\d+\.\d+)/);

                        if (latMatch && lngMatch) {
                            lat = parseFloat(latMatch[1]);
                            lng = parseFloat(lngMatch[1]);
                        }
                    }

                    if (!lat && entity.Latitude) lat = entity.Latitude;
                    if (!lng && entity.Longitude) lng = entity.Longitude;

                    if (lat && lng) {
                        const isAssigned = !!entity.Référent_partenariat_club;

                        return (
                            <Marker
                                key={entity.Id}
                                position={[lat, lng]}
                                icon={createCustomIcon(entity.Statuts, isAssigned)}
                            >
                                <Popup>
                                    <div style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                        <strong style={{ fontSize: '1.1rem' }}>{entity.title}</strong><br />
                                        <span style={{ fontSize: '0.9rem', color: '#666' }}>{entity.address}</span><br />
                                        <div style={{ margin: '5px 0', borderTop: '1px solid #ccc', paddingTop: '5px' }}>
                                            <strong>Statut:</strong> {entity.Statuts}<br />
                                            <strong>Référent:</strong> {entity.Référent_partenariat_club || 'Non attribué'}
                                        </div>
                                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {!isAssigned && (
                                                <button
                                                    onClick={() => handleOpenAssignModal(entity)}
                                                    style={{
                                                        backgroundColor: '#4ade80',
                                                        color: 'black',
                                                        padding: '5px 10px',
                                                        border: '1px solid black',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    S'attribuer
                                                </button>
                                            )}
                                            {entity.Place && <a href={entity.Place} target="_blank" rel="noopener noreferrer">Voir sur Google Maps</a>}
                                            <button
                                                onClick={() => handleOpenCommentModal(entity)}
                                                style={{
                                                    backgroundColor: '#e0e7ff',
                                                    color: '#4338ca',
                                                    padding: '5px 10px',
                                                    border: '1px solid #4338ca',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                + Commentaire
                                            </button>
                                            <Link to={`/entity/${entity.Id}`} style={{
                                                backgroundColor: 'var(--brutal-black)',
                                                color: 'var(--brutal-white)',
                                                padding: '5px 10px',
                                                textDecoration: 'none',
                                                textAlign: 'center',
                                                fontWeight: 'bold'
                                            }}>
                                                Voir la fiche
                                            </Link>
                                            <Link to="/" state={{ editEntity: entity }} style={{
                                                backgroundColor: '#ffeb3b',
                                                color: 'black',
                                                padding: '5px 10px',
                                                textDecoration: 'none',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                border: '1px solid black'
                                            }}>
                                                ✎ Modifier
                                            </Link>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })}
            </MapContainer>

            {/* Add Mode Toggle Button */}
            <button
                onClick={toggleAddMode}
                style={{
                    position: 'absolute',
                    bottom: '30px',
                    right: '30px',
                    zIndex: 1000,
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: isAddMode ? '#ff4d4d' : 'var(--brutal-ice)',
                    border: '3px solid black',
                    boxShadow: '4px 4px 0px black',
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'transform 0.1s'
                }}
                title={isAddMode ? "Annuler l'ajout" : "Ajouter un lieu"}
            >
                {isAddMode ? '×' : '+'}
            </button>
            {isAddMode && (
                <div className="add-mode-tooltip" style={{
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
                    maxWidth: '250px'
                }}>
                    <div style={{ fontSize: '0.9rem' }}>Cliquez sur la carte pour placer le point</div>
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

            {/* Assignment Modal */}
            {showAssignModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        backgroundColor: 'var(--brutal-white)', padding: '20px',
                        border: 'var(--brutal-border)', boxShadow: 'var(--brutal-shadow)',
                        width: '90%', maxWidth: '400px'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Attribuer : {assignEntity?.title}</h3>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Choisir un référent existant</label>
                            <select
                                value={selectedReferent}
                                onChange={(e) => { setSelectedReferent(e.target.value); setNewReferent(''); }}
                                style={{ width: '100%', padding: '5px' }}
                            >
                                <option value="">-- Sélectionner --</option>
                                {referentOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '15px', textAlign: 'center' }}>- OU -</div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Ajouter un nouveau référent</label>
                            <input
                                type="text"
                                value={newReferent}
                                onChange={(e) => { setNewReferent(e.target.value); setSelectedReferent(''); }}
                                placeholder="Nom du référent"
                                style={{ width: '100%', padding: '5px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={handleCloseAssignModal}>Annuler</button>
                            <button
                                onClick={handleAssign}
                                disabled={isSubmitting}
                                style={{ backgroundColor: 'var(--brutal-ice)', fontWeight: 'bold' }}
                            >
                                {isSubmitting ? 'Enregistrement...' : 'Valider'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Comment Modal */}
            {showCommentModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000
                }}>
                    <div style={{
                        backgroundColor: 'var(--brutal-white)', padding: '20px',
                        border: 'var(--brutal-border)', boxShadow: 'var(--brutal-shadow)',
                        width: '90%', maxWidth: '400px'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Ajouter un commentaire</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>Pour : {commentEntity?.title}</p>

                        <div style={{ marginBottom: '15px' }}>
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Saisissez votre commentaire..."
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '10px',
                                    border: '2px solid black',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={handleCloseCommentModal}>Annuler</button>
                            <button
                                onClick={handleAddComment}
                                disabled={isSubmittingComment || !newComment.trim()}
                                style={{
                                    backgroundColor: 'var(--brutal-ice)',
                                    fontWeight: 'bold',
                                    opacity: isSubmittingComment || !newComment.trim() ? 0.5 : 1
                                }}
                            >
                                {isSubmittingComment ? 'Envoi...' : 'Ajouter'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MapComponent;
