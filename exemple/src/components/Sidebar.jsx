import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
// ... (previous imports)
import { createEntity, updateEntity } from '../services/api';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import ReferentEntitiesList from './ReferentEntitiesList';
import axios from 'axios';

// ...





























const Sidebar = ({ filters, setFilters, entities, refreshEntities, newLocation, setNewLocation, setIsAddMode, isMapHidden, setIsMapHidden, setIsSidebarHidden, userRole }) => {
    // Define all possible options from NocoDB schema
    const allStatusOptions = ['À contacter', 'En discussion', 'Confirmé (en attente de paiement)', 'Paiement effectué', 'Refusé', 'Sans réponse'];
    const allTypeOptions = ['Encart Pub', 'Tombola (Lots)', 'Partenaires', 'Mécénat', 'Stand', 'Subvention'];

    // Extract unique values for filters (merge with schema options)
    const statusOptions = [...new Set([...allStatusOptions, ...entities.map(e => e.Statuts).filter(Boolean)])];
    const typeOptions = [...new Set([...allTypeOptions, ...entities.map(e => e.Type).filter(Boolean)])];

    // Extract Referents
    const referentOptions = [...new Set(entities.map(e => e.Référent_partenariat_club).filter(Boolean))];

    // Calculate Financial Summary
    // Calculate Financial Summary
    // We want to track revenue but also specific counts (like Tombola) even if 0 revenue.
    // However, for the main revenue summary, we usually care about money.
    // User requested "Tombola avec juste le nombre de lieu" implying count is key there.
    // Logic:
    // 1. Main Group: Encart Pub, Mécénat, Partenaires (Individual lines + Subtotal)
    // 2. Others (revenue > 0)
    // 3. Subvention
    // 4. Tombola (Count only)

    const mainGroupTypes = ['Encart Pub', 'Mécénat', 'Partenaires', 'Stand'];
 // Or check includes 'Tombola'

    const financialStats = {
        mainGroup: { byType: {}, total: 0, count: 0 },
        subvention: { byType: {}, total: 0, count: 0 }, // Should be just one, but keeping structure generic
        others: { byType: {}, total: 0, count: 0 },
        tombola: { count: 0 } // Just count for Tombola
    };

    let totalRevenue = 0;

    const validFinancialStatuses = ['Confirmé (en attente de paiement)', 'Paiement effectué'];

    entities.forEach(e => {
        const type = e.Type;
        if (!type) return;

        // User Request: Filter Encart Pub to only show confirmed/paid
        // Applying this logic to exclude them from Revenue and Section counts
        if (type === 'Encart Pub' && !validFinancialStatuses.includes(e.Statuts)) {
            return;
        }

        const revenue = (e.Recette && parseFloat(e.Recette) > 0) ? parseFloat(e.Recette) : 0;

        // Update global total revenue (excluding Tombola)
        if (!type.includes('Tombola')) {
            totalRevenue += revenue;
        }

        // Bucket Logic
        if (mainGroupTypes.includes(type)) {
            if (!financialStats.mainGroup.byType[type]) financialStats.mainGroup.byType[type] = { amount: 0, count: 0 };
            financialStats.mainGroup.byType[type].amount += revenue;
            financialStats.mainGroup.byType[type].count += 1;
            financialStats.mainGroup.total += revenue;
            financialStats.mainGroup.count += 1;
        } else if (type === 'Subvention') {
            if (!financialStats.subvention.byType[type]) financialStats.subvention.byType[type] = { amount: 0, count: 0 };
            financialStats.subvention.byType[type].amount += revenue;
            financialStats.subvention.byType[type].count += 1;
            financialStats.subvention.total += revenue;
            financialStats.subvention.count += 1;
        } else if (type.includes('Tombola')) {
            financialStats.tombola.count += 1;
            // distinct from others? Yes
        } else {
            // Others - only track if has revenue (classic behavior) to avoid clutter?
            if (revenue > 0) {
                if (!financialStats.others.byType[type]) financialStats.others.byType[type] = { amount: 0, count: 0 };
                financialStats.others.byType[type].amount += revenue;
                financialStats.others.byType[type].count += 1;
                financialStats.others.total += revenue;
                financialStats.others.count += 1;
            }
        }
    });

    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        Place: '',
        title: '',
        address: '',
        phoneNumber: '',
        website: '',
        Statuts: '',
        Type: '',
        Referent: '',
        Recette: '',
        gps: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    // Nearby Places Search State
    const [showPlaceSelector, setShowPlaceSelector] = useState(false);
    const [nearbyPlaces, setNearbyPlaces] = useState([]);
    const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
    const [showReferentDropdown, setShowReferentDropdown] = useState(false);



    // Toggle for secondary details
    const [showDetails, setShowDetails] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Reset filters on load if needed or handle initial state
    // ...

    useEffect(() => {
        if (location.state && location.state.editEntity) {
            const entity = location.state.editEntity;
            setFormData({
                Place: entity.Place || '',
                title: entity.title || '',
                address: entity.address || '',
                phoneNumber: entity.phoneNumber || '',
                website: entity.website || '',
                Statuts: entity.Statuts || '',
                Type: entity.Type || '',
                Referent: entity.Référent_partenariat_club || '',
                Recette: entity.Recette || '',
                gps: entity.gps || ''
            });
            setEditingId(entity.Id);
            setIsEditing(true);
            setShowAddModal(true);
            // Clear state so it doesn't reopen on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location, navigate]);

    useEffect(() => {
        if (newLocation) {
            setFormData(prev => ({
                ...prev,
                gps: `${newLocation.lat};${newLocation.lng}`
            }));

            // Trigger address lookup immediately (User request: restore original behavior)
            reverseGeocode(newLocation.lat, newLocation.lng);

            // Trigger nearby places search
            fetchNearbyPlaces(newLocation.lat, newLocation.lng);
            setShowPlaceSelector(true);
        }
    }, [newLocation]);

    const fetchNearbyPlaces = async (lat, lng) => {
        setIsLoadingPlaces(true);
        setNearbyPlaces([]);
        try {
            const query = `
                [out:json];
                (
                  node(around:50,${lat},${lng})["name"];
                  way(around:50,${lat},${lng})["name"];
                );
                out center;
            `;
            const response = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
            const places = response.data.elements.filter(el => {
                if (!el.tags || !el.tags.name) return false;
                const { amenity, shop, tourism, leisure, craft, office } = el.tags;

                // Filter: Must have a relevant type (amenity, shop, etc.)
                if (!amenity && !shop && !tourism && !leisure && !craft && !office) return false;

                // Explicit exclude parking
                if (amenity === 'parking') return false;

                return true;
            });
            setNearbyPlaces(places);
        } catch (error) {
            console.error("Error fetching nearby places:", error);
            // Fallback or just show empty list
        } finally {
            setIsLoadingPlaces(false);
        }
    };

    const formatPlaceSubtitle = (tags) => {
        return tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.craft || tags.office || 'Lieu';
    };

    const handleSelectPlace = (place) => {
        let lat = place.lat;
        let lon = place.lon;
        if (!lat && place.center) {
            lat = place.center.lat;
            lon = place.center.lon;
        }



        setFormData(prev => ({
            ...prev,
            title: place.tags.name || '',
            // address: We rely on the API call below, or the one from useEffect. 
            // We do NOT overwrite it with OSM tags often missing number.
            website: place.tags.website || '',
            phoneNumber: place.tags.phone || place.tags['contact:phone'] || '',
            gps: (lat && lon) ? `${lat};${lon}` : prev.gps
        }));

        // Always refresh address from API using exact POI coordinates for best precision
        if (lat && lon) {
            reverseGeocode(lat, lon);
        } else if (newLocation) {
            reverseGeocode(newLocation.lat, newLocation.lng);
        }

        setShowPlaceSelector(false);
        setShowAddModal(true);
    };

    const handleManualAdd = () => {
        setShowPlaceSelector(false);
        setFormData(prev => ({
            ...prev,
            title: '',
            address: '',
            website: '',
            phoneNumber: ''
        }));

        if (newLocation) {
            reverseGeocode(newLocation.lat, newLocation.lng);
        }

        setShowAddModal(true);
    };

    const handleCancelPlaceSelection = () => {
        setShowPlaceSelector(false);
        setNewLocation(null); // Cancel the whole add action
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleCloseModal = () => {
        setShowAddModal(false);
        setShowPlaceSelector(false);
        setFormToInitial();
        setNewLocation(null);
        setIsEditing(false);
        setEditingId(null);
    };

    const setFormToInitial = () => {
        setFormData({
            Place: '',
            title: '',
            address: '',
            phoneNumber: '',
            website: '',
            Statuts: '',
            Type: '',
            Referent: '',
            Recette: '',
            gps: ''
        });
    };

    const handleAddOrUpdate = async () => {
        if (isSubmitting) return;

        if (!formData.gps) {
            alert('Il est impératif d\'avoir un point GPS. Veuillez géolocaliser l\'adresse ou cliquer sur la carte.');
            return;
        }
        if (!formData.title) {
            alert('Le nom du lieu est obligatoire.');
            return;
        }

        setIsSubmitting(true);
        try {
            const entityData = {
                title: formData.title,
                Statuts: formData.Statuts || "À contacter",
                gps: formData.gps
            };

            // Add optional fields only if they have values
            if (formData.Place) entityData.Place = formData.Place;
            if (formData.address) entityData.address = formData.address;
            if (formData.phoneNumber) entityData.phoneNumber = formData.phoneNumber;
            if (formData.website) entityData.website = formData.website;
            if (formData.website) entityData.website = formData.website;

            // Allow clearing Type and Recette (sending null if empty)
            entityData.Type = formData.Type || null;

            if (formData.Referent) entityData.Référent_partenariat_club = formData.Referent;

            if (formData.Recette === '' || formData.Recette === null || formData.Recette === undefined) {
                entityData.Recette = null;
            } else {
                entityData.Recette = parseFloat(formData.Recette);
            }

            if (isEditing && editingId) {
                // Automatic Logging
                const originalEntity = entities.find(e => e.Id === editingId);
                if (originalEntity) {
                    const changes = [];
                    if (entityData.Statuts !== originalEntity.Statuts) changes.push(`Statut: ${originalEntity.Statuts || 'Vide'} -> ${entityData.Statuts}`);
                    if (entityData.Type !== originalEntity.Type) changes.push(`Type: ${originalEntity.Type || 'Vide'} -> ${entityData.Type}`);
                    if (entityData.Recette !== originalEntity.Recette) changes.push(`Recette: ${originalEntity.Recette || 0} -> ${entityData.Recette}`);

                    if (changes.length > 0) {
                        const now = new Date();
                        const timestamp = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                        const logMessage = `[${timestamp}] Modification système:\n${changes.join('\n')}`;
                        const existingComments = originalEntity.Comments || '';
                        entityData.Comments = existingComments ? `${existingComments}\n${logMessage}` : logMessage;
                    }
                }

                await updateEntity(editingId, entityData);

                if (isEditing && editingId) {
                     const originalEntity = entities.find(e => e.Id === editingId);
                     // Only sync if Type REALLY changed
                     if (originalEntity && entityData.Type !== originalEntity.Type) {
                         console.log(`[Sidebar] Type changed (${originalEntity.Type} -> ${entityData.Type}). Syncing...`);
                         const { synchronizeTrackingType } = await import('../services/api');
                         // Pass validation of Title
                         await synchronizeTrackingType(editingId, entityData.Type, originalEntity);
                     }
                }

                alert('Lieu modifié avec succès !');
            } else {
                // Automatic Logging for Creation
                const now = new Date();
                const timestamp = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                entityData.Comments = `[${timestamp}] Création du lieu`;

                const created = await createEntity(entityData);

                // Automatic Link Creation for New Entity
                if (created && created.Id && entityData.Type) {
                    try {
                        console.log(`[Sidebar] New entity created. Syncing tracking for type: ${entityData.Type}`);
                        const { synchronizeTrackingType } = await import('../services/api');
                        await synchronizeTrackingType(created.Id, entityData.Type);
                    } catch (e) { console.error("Auto-link error:", e); }
                }

                alert('Lieu ajouté !');
            }

            handleCloseModal();

            // Restore sidebar on mobile
            if (setIsSidebarHidden && window.innerWidth <= 768) {
                setIsSidebarHidden(false);
            }

            if (refreshEntities) refreshEntities();
        } catch (e) {
            const errorMsg = e.response?.data?.message || e.response?.data?.msg || e.message || 'Erreur lors de l\'opération';
            alert(`Erreur : ${errorMsg}`);
            handleCloseModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    const reverseGeocode = async (lat, lng) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const formattedAddress = `${addr.house_number ? addr.house_number + ' ' : ''}${addr.road || ''}, ${addr.postcode || ''} ${addr.city || addr.town || addr.village || ''}`;
                setFormData(prev => ({
                    ...prev,
                    address: formattedAddress.replace(/^, /, '')
                }));
            }
        } catch (error) {
            console.error("Reverse geocoding error:", error);
        }
    };

    const detectUserLocation = () => {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                setFormData(prev => ({
                    ...prev,
                    gps: `${latitude};${longitude}`,
                    // Place: googleMapsUrl // We mainly want gps
                }));

                // Trigger reverse geocoding
                reverseGeocode(latitude, longitude);

                setIsDetectingLocation(false);
                alert("Position détectée avec succès !");
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = "Impossible de détecter votre position.";
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

    return (
        <>
            <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Filtres</h2>
                </div>
                
                <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '10px', 
                    marginBottom: '10px',
                    borderBottom: '2px solid black',
                    paddingBottom: '10px'
                }}>
                    {userRole === 'ADMIN' && (
                        <>
                            <Link to="/dashboard" style={{ fontSize: '0.9rem', textDecoration: 'underline', color: 'red', fontWeight: 'bold' }}>
                                Dashboard
                            </Link>
                            <Link to="/suivi" style={{ fontSize: '0.9rem', textDecoration: 'underline', color: 'blue', fontWeight: 'bold' }}>
                                Suivi
                            </Link>
                            <Link to="/brochure-admin" style={{ fontSize: '0.9rem', textDecoration: 'underline', color: 'purple', fontWeight: 'bold' }}>
                                Brochure
                            </Link>
                        </>
                    )}
                    <Link to="/bilan" style={{ fontSize: '0.9rem', textDecoration: 'underline', color: 'green', fontWeight: 'bold' }}>
                        Bilan
                    </Link>
                    <Link to="/history" style={{ fontSize: '0.9rem', textDecoration: 'underline', color: 'var(--brutal-black)' }}>
                        Historique
                    </Link>
                </div>
            </div>

            {/* Mobile Map Toggle */}
            <button
                className="mobile-map-toggle"
                onClick={() => setIsMapHidden(!isMapHidden)}
                style={{
                    marginBottom: '15px',
                    width: '100%',
                    padding: '10px',
                    backgroundColor: isMapHidden ? 'var(--brutal-ice)' : 'var(--brutal-white)',
                }}
            >
                {isMapHidden ? '🗺️ Afficher la carte' : '📋 Masquer la carte'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold' }}>Recherche</label>
                <input
                    type="text"
                    name="Search"
                    placeholder="Nom ou adresse..."
                    value={filters.Search || ''}
                    onChange={handleFilterChange}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold' }}>Statut</label>
                <select name="Statuts" value={filters.Statuts || ''} onChange={handleFilterChange}>
                    <option value="">Tous</option>
                    {statusOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold' }}>Type</label>
                <select name="Type" value={filters.Type || ''} onChange={handleFilterChange}>
                    <option value="">Tous</option>
                    {typeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold' }}>Référent</label>
                <select name="Referent" value={filters.Referent || ''} onChange={handleFilterChange}>
                    <option value="">Tous</option>
                    <option value="Non attribué">Non attribué</option>
                    {referentOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>

            {/* Assigned Entities List */}
            {
                filters.Referent && filters.Referent !== 'Non attribué' && (() => {
                    const assignedEntities = entities.filter(e => e.Référent_partenariat_club === filters.Referent);

                    // Custom Sort by Status as requested
                    const statusOrder = {
                        'À contacter': 1,
                        'En discussion': 2,
                        'Confirmé (en attente de paiement)': 3,
                        'Paiement effectué': 3,
                        'Refusé': 4,
                        'Sans réponse': 4
                    };
                    const getOrder = (status) => statusOrder[status] || 99;

                    const sortedEntities = [...assignedEntities].sort((a, b) => {
                        const orderA = getOrder(a.Statuts);
                        const orderB = getOrder(b.Statuts);
                        if (orderA !== orderB) return orderA - orderB;
                        // Secondary sort by title
                        return (a.title || '').localeCompare(b.title || '');
                    });

                    return sortedEntities.length > 0 && (
                        <ReferentEntitiesList entities={sortedEntities} referentName={filters.Referent} />
                    );
                })()
            }

            {/* Financial Summary Section */}
            {
                (totalRevenue > 0 || financialStats.tombola.count > 0) && (
                    <div style={{ marginTop: '30px', borderTop: '4px solid black', paddingTop: '15px' }}>
                        <h3 style={{ fontSize: '1.4rem', marginBottom: '15px', textTransform: 'uppercase', fontWeight: 900 }}>Suivi Financier</h3>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontWeight: 'bold',
                            marginBottom: '20px',
                            backgroundColor: 'var(--brutal-yellow)', // Highlight total
                            padding: '10px',
                            border: '2px solid black'
                        }}>
                            <span style={{ textTransform: 'uppercase' }}>Total Recettes</span>
                            <span>{totalRevenue.toLocaleString('fr-FR')} €</span>
                        </div>

                        <div style={{ fontSize: '0.9rem' }}>
                            {/* Main Group: Encart, Mécénat, Partenaires */}
                            {financialStats.mainGroup.count > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', textTransform: 'uppercase', color: 'black', borderBottom: '2px solid black', display: 'inline-block' }}>Partenariats</h4>
                                    {Object.entries(financialStats.mainGroup.byType).map(([type, data]) => (
                                        <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span>{type} ({data.count})</span>
                                            <span>{data.amount.toLocaleString('fr-FR')} €</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid black', fontWeight: 'bold' }}>
                                        <span>Sous-total</span>
                                        <span>{financialStats.mainGroup.total.toLocaleString('fr-FR')} €</span>
                                    </div>
                                </div>
                            )}

                            {/* Others */}
                            {financialStats.others.count > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', textTransform: 'uppercase', color: 'black', borderBottom: '2px solid black', display: 'inline-block' }}>Divers</h4>
                                    {Object.entries(financialStats.others.byType).map(([type, data]) => (
                                        <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span>{type} ({data.count})</span>
                                            <span>{data.amount.toLocaleString('fr-FR')} €</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Subvention - Added specifically */}
                            {financialStats.subvention.count > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', textTransform: 'uppercase', color: 'black', borderBottom: '2px solid black', display: 'inline-block' }}>Subventions</h4>
                                    {Object.entries(financialStats.subvention.byType).map(([type, data]) => (
                                        <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <span>{type} ({data.count})</span>
                                            <span>{data.amount.toLocaleString('fr-FR')} €</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tombola - Count only */}
                            {financialStats.tombola.count > 0 && (
                                <div style={{ marginTop: '10px', paddingTop: '10px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', textTransform: 'uppercase', color: 'black', borderBottom: '2px solid black', display: 'inline-block' }}>Tombola</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>Participation</span>
                                        <span style={{ backgroundColor: 'black', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                                            {financialStats.tombola.count} Donateurs
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            <div style={{ marginTop: 'auto' }}>
                <p style={{ fontSize: '0.8rem' }}>
                    <strong>Total:</strong> {entities.length} entités <br />
                    <strong>Attribués:</strong> {entities.filter(e => e.Référent_partenariat_club).length} / {entities.length}
                </p>
            </div>

            {/* Add / Edit Modal */}
            {showAddModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10000
                }}>
                    <div className="add-modal" style={{
                        backgroundColor: 'var(--brutal-white)', padding: '20px',
                        border: 'var(--brutal-border)', boxShadow: 'var(--brutal-shadow)',
                        width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', textTransform: 'uppercase' }}>
                            {isEditing ? 'MODIFIER LE LIEU' : 'AJOUTER UN NOUVEAU LIEU'}
                        </h2>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Nom du lieu *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleFormChange}
                                required
                                placeholder="Ex: Restaurant Le Gourmet"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Référent</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    name="Referent"
                                    value={formData.Referent}
                                    onChange={handleFormChange}
                                    onFocus={() => setShowReferentDropdown(true)}
                                    placeholder="Sélectionner ou saisir un nom..."
                                    autoComplete="off"
                                    style={{ width: '100%', padding: '5px' }}
                                />
                                {showReferentDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        backgroundColor: 'white',
                                        border: '1px solid black',
                                        zIndex: 1000,
                                        boxShadow: 'var(--brutal-shadow)'
                                    }}>
                                        {referentOptions.filter(opt => opt.toLowerCase().includes((formData.Referent || '').toLowerCase())).map(opt => (
                                            <div
                                                key={opt}
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent blur
                                                    handleFormChange({ target: { name: 'Referent', value: opt } });
                                                    setShowReferentDropdown(false);
                                                }}
                                                style={{
                                                    padding: '8px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #eee',
                                                    fontWeight: formData.Referent === opt ? 'bold' : 'normal',
                                                    backgroundColor: formData.Referent === opt ? '#f0f0f0' : 'white'
                                                }}
                                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                                                onMouseLeave={(e) => e.target.style.backgroundColor = formData.Referent === opt ? '#f0f0f0' : 'white'}
                                            >
                                                {opt}
                                            </div>
                                        ))}
                                        {referentOptions.filter(opt => opt.toLowerCase().includes((formData.Referent || '').toLowerCase())).length === 0 && (
                                            <div style={{ padding: '8px', fontStyle: 'italic', color: '#666' }}
                                                onMouseDown={(e) => {
                                                    // Optional: clicking this could just close
                                                    e.preventDefault();
                                                    setShowReferentDropdown(false);
                                                }}
                                            >
                                                Nouvelle entrée : "{formData.Referent}"
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Overlay to close on outside click if needed, or rely on blur handling */}
                                {showReferentDropdown && (
                                    <div
                                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999, cursor: 'default' }}
                                        onClick={() => setShowReferentDropdown(false)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Statut</label>
                            <select name="Statuts" value={formData.Statuts} onChange={handleFormChange} style={{ width: '100%' }}>
                                <option value="">Par défaut (À contacter)</option>
                                {allStatusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Type</label>
                            <select name="Type" value={formData.Type} onChange={handleFormChange} style={{ width: '100%' }}>
                                <option value="">Sélectionner...</option>
                                {allTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Recette (€)</label>
                            <input
                                type="number"
                                name="Recette"
                                value={formData.Recette}
                                onChange={handleFormChange}
                                step="0.01"
                                min="0"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '15px' }}>
                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Coordonnées GPS *</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <input
                                    type="text"
                                    name="gps"
                                    value={formData.gps || ''}
                                    onChange={handleFormChange}
                                    readOnly
                                    style={{ width: '100%', backgroundColor: '#eee' }}
                                />
                                {formData.gps && <span style={{ color: 'green', fontSize: '1.2rem' }}>✓</span>}
                            </div>
                        </div>

                        {!isEditing && (
                            <button
                                type="button"
                                onClick={detectUserLocation}
                                disabled={isDetectingLocation}
                                style={{
                                    marginBottom: '15px',
                                    fontSize: '0.9rem',
                                    width: '100%',
                                    backgroundColor: 'var(--brutal-ice)',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>📍</span>
                                {isDetectingLocation ? 'Localisation...' : 'Me localiser'}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowDetails(!showDetails)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                marginBottom: '15px',
                                backgroundColor: '#f0f0f0',
                                border: '1px solid black',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}
                        >
                            <span>{showDetails ? 'Masquer les détails' : 'Plus de détails (Adresse, Contact...)'}</span>
                            <span>{showDetails ? '▲' : '▼'}</span>
                        </button>

                        {showDetails && (
                            <div style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '15px', backgroundColor: '#fafafa' }}>
                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Téléphone</label>
                                    <input
                                        type="text"
                                        name="phoneNumber"
                                        value={formData.phoneNumber}
                                        onChange={handleFormChange}
                                        placeholder="Ex: 04 50 12 34 56"
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Adresse</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleFormChange}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Site web</label>
                                    <input
                                        type="text"
                                        name="website"
                                        value={formData.website}
                                        onChange={handleFormChange}
                                        placeholder="Ex: https://www.exemple.fr"
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div className="form-group" style={{ marginBottom: '15px' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Lien Google Maps (Optionnel)</label>
                                    <input
                                        type="text"
                                        name="Place"
                                        value={formData.Place}
                                        onChange={handleFormChange}
                                        placeholder="https://www.google.com/maps?q=..."
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        )}


                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button onClick={handleCloseModal} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Annuler</button>
                            <button onClick={handleAddOrUpdate} disabled={isSubmitting} style={{ backgroundColor: 'var(--brutal-ice)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {isSubmitting ? (isEditing ? 'Modification...' : 'Ajout...') : (isEditing ? 'Enregistrer' : 'Ajouter')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Place Selector Modal - Kept as requested for functionality */}
            {showPlaceSelector && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 10001
                }}>
                    <div style={{
                        backgroundColor: 'var(--brutal-white)', padding: '20px',
                        border: 'var(--brutal-border)', boxShadow: 'var(--brutal-shadow)',
                        width: '90%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Lieux à proximité</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            Sélectionnez un lieu pour préremplir la fiche, ou créez-le manuellement.
                        </p>

                        {isLoadingPlaces ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                Chargement des lieux... (Overpass API)
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                                {nearbyPlaces.length > 0 ? (
                                    nearbyPlaces.map((place, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectPlace(place)}
                                            style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                border: '1px solid #ccc',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                borderRadius: '4px'
                                            }}
                                        >
                                            <strong>{place.tags.name}</strong>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                {formatPlaceSubtitle(place.tags)}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div style={{ padding: '10px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                                        Aucun lieu commercial identifié à proximité immédiate.
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={handleManualAdd}
                                style={{
                                    padding: '10px',
                                    backgroundColor: 'var(--brutal-ice)',
                                    border: '2px solid black',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                ✍️ Pas dans la liste ? Créer manuellement
                            </button>
                            <button
                                onClick={handleCancelPlaceSelection}
                                style={{
                                    padding: '8px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                }}
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
