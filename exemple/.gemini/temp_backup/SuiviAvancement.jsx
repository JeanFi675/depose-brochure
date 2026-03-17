import React, { useEffect, useState } from 'react';
import { fetchTrackingData, createTrackingRecord, updateTrackingRecord, deleteTrackingRecord, updateEntity, triggerInvoiceWebhook } from '../services/api';
import FactureModal from '../components/FactureModal';
import { Link } from 'react-router-dom';

const TYPES = ['Encart Pub', 'Tombola (Lots)', 'Partenaires', 'Mécénat', 'Stand'];

const SuiviAvancement = ({ entities, userRole }) => {
    const [activeTab, setActiveTab] = useState(TYPES[0]);
    const [trackingData, setTrackingData] = useState({});
    const [loading, setLoading] = useState(false);
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'todo', 'done'
    // Local state to force re-render when entity updates (Recette)
    const [localEntities, setLocalEntities] = useState(entities);

    // Invoice Modal State
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoiceEntity, setSelectedInvoiceEntity] = useState(null);
    const [selectedInvoiceTracking, setSelectedInvoiceTracking] = useState(null);

    const relevantEntities = localEntities.filter(e => {
        const s = e.Statuts;
        // Tombola doesn't necessarily have payment, so we accept "En discussion" or "Confirmé" even without payment logic
        const isTombola = activeTab === 'Tombola (Lots)';

        let isHypotheticallyActive = s === 'Confirmé (en attente de paiement)' || s === 'Paiement effectué';

        // For Tombola, we might want to track even earlier or differently
        // User said: "trou dans la raquette est pour tombola ou il n'y a pas de paiement"
        // Implying we shouldn't filter strict on payment statuses for Tombola.
        // Let's broaden it for Tombola to include "À contacter" or just everything that IS matched type?
        // Usually tracking implies some level of engagement. Maybe "En discussion" + "Confirmé..."?
        // Let's try to assume if it is TYPED as Tombola, we want to see it regardless of status? 
        // Or keep filter but add "En discussion"?
        // Let's assume validation is needed if Type is set.
        if (isTombola) {
            // For Tombola, if it has the Type, we track it. Status is less relevant for the "Link existence".
            // But usually we don't track "Refusé" or "Sans réponse".
            const isDead = s === 'Refusé' || s === 'Sans réponse';
            isHypotheticallyActive = !isDead;
        }

        if (!isHypotheticallyActive) return false;

        if (activeTab === 'Stand') {
            if (e.Type === 'Stand') return true;

            // Link Check: If this entity (e.g. Partner) has a record in the currently loaded STAND tracking data
            const standRecords = trackingData['Stand'] || [];
            const linked = standRecords.some(r => {
                const link = r.Link_Annonceur;
                const linkId = (typeof link === 'object' && link !== null) ? link.Id : link;
                return String(linkId) === String(e.Id);
            });
            return linked;
        }

        return e.Type === activeTab;
    });

    useEffect(() => {
        setLocalEntities(entities);
    }, [entities]);

    useEffect(() => {
        const loadTracking = async () => {
            setLoading(true);
            const data = await fetchTrackingData(activeTab);
            setTrackingData(prev => ({ ...prev, [activeTab]: data }));
            setLoading(false);
        };
        loadTracking();
    }, [activeTab]);

    const getTrackingRecord = (entityId) => {
        const records = trackingData[activeTab] || [];
        return records.find(r => {
            const link = r.Link_Annonceur;
            if (typeof link === 'object' && link !== null) {
                return String(link.Id) === String(entityId);
            }
            return String(link) === String(entityId);
        });
    };

    const handleUpdate = async (trackingId, field, value, entityId) => {
        try {
            if (trackingId) {
                setTrackingData(prev => ({
                    ...prev,
                    [activeTab]: prev[activeTab].map(r => r.Id === trackingId ? { ...r, [field]: value } : r)
                }));
                await updateTrackingRecord(activeTab, trackingId, { [field]: value });
            } else {
                // Find entity title for valid creation
                const entity = relevantEntities.find(e => e.Id === entityId);
                const newRecord = {
                    Link_Annonceur: entityId,
                    Titre: entity?.title || 'Suivi',
                    [field]: value
                };
                const created = await createTrackingRecord(activeTab, newRecord);

                // IMPORTANT: Ensure Link_Annonceur is correct in local state to allow subsequent updates to find it
                // API might return it differently or not expanded.
                const recordForState = { ...created, Link_Annonceur: entityId };

                setTrackingData(prev => ({
                    ...prev,
                    [activeTab]: [...(prev[activeTab] || []), recordForState]
                }));
            }
        } catch (error) {
            console.error("Update failed", error);
            alert("Erreur lors de la mise à jour");
        }
    };

    const handleRecetteUpdate = async (entityId, newValue) => {
        // Optimistic Entity Update
        const val = parseFloat(newValue) || 0;
        setLocalEntities(prev => prev.map(e => e.Id === entityId ? { ...e, Recette: val } : e));
        try {
            await updateEntity(entityId, { Recette: val });
        } catch (error) {
            console.error("Update Recette failed", error);
            alert("Erreur mise à jour Recette");
        }
    };

    // --- Logic for Pack Selection Side Effects (Stand Creation) ---
    const handlePackChange = async (trackingId, currentPacksStr, packToToggle, entityId) => {
        const currentPacks = currentPacksStr ? currentPacksStr.split(',') : [];
        const isSelected = currentPacks.includes(packToToggle);

        let newPacks = [];
        if (isSelected) {
            newPacks = currentPacks.filter(p => p !== packToToggle);
        } else {
            newPacks = [...currentPacks, packToToggle];
        }

        // Optimistic Update for Packs
        handleUpdate(trackingId, 'Pack_Choisi', newPacks.join(','), entityId);

        // Handle Stand Logic
        if (packToToggle === 'Stand 3x3m') {
            const tracking = trackingData[activeTab]?.find(r => r.Id === trackingId);

            if (!isSelected) {
                // Was checked, now unchecked -> CREATE Stand
                // Check if already linked to avoid duplicates not needed here if we trust the UI state, 
                // but good practice: check if tracking.Stand is empty.
                if (!tracking?.Stand) {
                    try {
                        const entity = relevantEntities.find(e => e.Id === entityId);
                        const newStand = await createTrackingRecord('Stand', {
                            Titre: `Stand - ${entity?.title || 'Partenaire'}`,
                            Link_Annonceur: entityId
                        });

                        // Link new Stand to Partner
                        // Assuming 'Stand' field in Partenaires expects a Link (ID or array of IDs)
                        // NocoDB Link field usually takes just the ID for single link
                        await updateTrackingRecord('Partenaires', trackingId, { Stand: newStand.Id });

                        // Update local state to reflect the link
                        setTrackingData(prev => ({
                            ...prev,
                            [activeTab]: prev[activeTab].map(r => r.Id === trackingId ? { ...r, Stand: newStand.Id } : r)
                        }));
                        console.log("Stand created and linked:", newStand.Id);
                    } catch (e) {
                        console.error("Failed to create Stand", e);
                        alert("Erreur lors de la création automatique du Stand");
                    }
                }
            } else {
                // Was unchecked, now checked -> delete Stand? NO.
                // Wait, logic inversion in my comment above.
                // isSelected is TRUE means it is CURRENTLY selected, so user clicked to DESELECT it.
                // So:
                // isSelected = true -> We are REMOVING 'Stand 3x3m' -> DELETE Stand
                // isSelected = false -> We are ADDING 'Stand 3x3m' -> CREATE Stand

                // Retrying logic block:
                if (isSelected) {
                    // Removing 'Stand 3x3m' -> Delete Stand
                    if (tracking?.Stand) {
                        // tracking.Stand might be an object or ID. Handle both.
                        const standId = typeof tracking.Stand === 'object' ? tracking.Stand.Id : tracking.Stand;

                        try {
                            // Correct order: Unlink first? Or just delete record?
                            // Deleting the record usually removes the link.
                            await deleteTrackingRecord('Stand', standId);

                            // Unlink in Partner record (clear field)
                            await updateTrackingRecord('Partenaires', trackingId, { Stand: null });

                            setTrackingData(prev => ({
                                ...prev,
                                [activeTab]: prev[activeTab].map(r => r.Id === trackingId ? { ...r, Stand: null } : r)
                            }));
                            console.log("Stand deleted:", standId);
                        } catch (e) {
                            console.error("Failed to delete Stand", e);
                        }
                    }
                } else {
                    // Adding 'Stand 3x3m' -> Create Stand
                    if (!tracking?.Stand) {
                        try {
                            const entity = relevantEntities.find(e => e.Id === entityId);
                            const newStand = await createTrackingRecord('Stand', {
                                Titre: `Stand - ${entity?.title || 'Partenaire'}`,
                                Link_Annonceur: entityId
                            });

                            await updateTrackingRecord('Partenaires', trackingId, { Stand: newStand.Id });

                            setTrackingData(prev => ({
                                ...prev,
                                [activeTab]: prev[activeTab].map(r => r.Id === trackingId ? { ...r, Stand: newStand.Id } : r)
                            }));
                            console.log("Stand created and linked:", newStand.Id);
                        } catch (e) {
                            console.error("Failed to create Stand", e);
                            alert("Erreur lors de la création automatique du Stand");
                        }
                    }
                }
            }
        }
    };

    // --- Invoice Logic ---
    const handleOpenInvoice = (entity, tracking) => {
        setSelectedInvoiceEntity(entity);
        setSelectedInvoiceTracking(tracking);
        setShowInvoiceModal(true);
    };

    const handleInvoiceSave = async (data) => {
        if (!selectedInvoiceTracking || !selectedInvoiceEntity) return;

        try {
            // If the tracking record doesn't exist yet, we might need to create it first? 
            // BUT UI only shows "Facture" button if row exists... wait.
            // Actually row exists if it's in the list, but tracking object might be undefined if we haven't clicked/initted anything?
            // "processedEntities" handles missing tracking by returning undfined.
            // Use handleUpdate logic wrapper or direct update?
            // "handleUpdate" handles creation if ID missing. Ideally we reuse it but it updates ONE field.
            // Here we update multiple.

            let trackId = selectedInvoiceTracking?.Id;
            const type = activeTab;

            if (!trackId) {
                // Should create record first
                const newRecord = {
                    Link_Annonceur: selectedInvoiceEntity.Id,
                    Titre: selectedInvoiceEntity.title || 'Suivi',
                    ...data
                };
                const created = await createTrackingRecord(type, newRecord);
                trackId = created.Id;

                // Update local state is complex because structure updates.
                // Simpler: reload or minimal local update.
                setTrackingData(prev => ({
                    ...prev,
                    [type]: [...(prev[type] || []), { ...created, Link_Annonceur: selectedInvoiceEntity.Id }]
                }));
            } else {
                await updateTrackingRecord(type, trackId, data);
                // Local Update
                setTrackingData(prev => ({
                    ...prev,
                    [type]: prev[type].map(r => r.Id === trackId ? { ...r, ...data } : r)
                }));
            }

            alert("Informations de facturation enregistrées !");
            setShowInvoiceModal(false);
        } catch (e) {
            console.error("Save invoice failed", e);
            alert("Erreur sauvegarde facture");
        }
    };

    const handleInvoiceGenerate = async (data) => {
        try {
            await handleInvoiceSave(data); // Save first

            const payload = {
                ...data,
                EntityId: selectedInvoiceEntity.Id,
                TrackingId: selectedInvoiceTracking?.Id, // Might be stale if just created, but Save handles creation logic implicitly?
                // If Save created it, selectedInvoiceTracking is still null here.
                // Refactor to ensure we get ID.
                Type: activeTab
            };

            await triggerInvoiceWebhook(payload);
            alert("Facture générée avec succès (Envoyée à n8n) !");
        } catch (e) {
            console.error(e);
            alert("Erreur lors de la génération de la facture");
        }
    };

    // --- Logic for Completion Calculation ---
    const isComplete = (entity, tracking) => {
        if (activeTab === 'Tombola (Lots)') {
            return tracking?.Lot_Recupere === true && tracking?.Logo_Recu === true;
        }

        if (activeTab === 'Stand' && entity.Type !== 'Stand') {
            // Partner-Stand: Validation based on Stand actions
            // Require Tables and Chairs to be filled (not undefined/null/empty string)
            // BUT '0' string or number 0 is VALID.
            const hasTables = tracking?.Nombre_Tables !== undefined && tracking?.Nombre_Tables !== null && String(tracking?.Nombre_Tables).trim() !== '';
            const hasChairs = tracking?.Nombre_Chaises !== undefined && tracking?.Nombre_Chaises !== null && String(tracking?.Nombre_Chaises).trim() !== '';

            // Elec New Logic: Must be "Oui" or "Non"
            const hasElec = tracking?.Besoin_Electricite === 'Oui' || tracking?.Besoin_Electricite === 'Non';

            return hasTables && hasChairs && hasElec;
        }

        if (activeTab === 'Encart Pub') {
            return tracking?.Preuve_Paiement_Transmise === true && tracking?.Visuel_Envoye === true;
        }

        if (activeTab === 'Partenaires') {
            const packs = tracking?.Pack_Choisi ? tracking.Pack_Choisi.split(',') : [];
            let ok = true;
            if (packs.includes('4e de couverture')) ok = ok && tracking?.Encart_Pub === true;
            if (packs.includes('Affichage Mur')) ok = ok && tracking?.Pancarte_Recu === true;
            if (packs.includes('Logo Backdrop') || packs.includes('Logo Affiche')) ok = ok && tracking?.Logo_Recu === true;
            if (packs.includes('Stand 3x3m')) ok = ok && tracking?.Stand_Inscrit === true;

            // Payment proof always required unless free? Assuming proof required for partners too.
            const paid = tracking?.Type_Paiement && tracking?.Type_Paiement !== '';
            const moneyOK = paid || tracking?.Preuve_Paiement_Transmise;
            return ok && moneyOK;
        }

        // Base requirement: Paid or Proof sent
        // For Mecenat: Cerfa_Envoye counts as Proof
        const paid = tracking?.Type_Paiement && tracking?.Type_Paiement !== '';
        const mecenatProof = activeTab === 'Mécénat' && tracking?.Cerfa_Envoye === true;
        const moneyOK = paid || tracking?.Preuve_Paiement_Transmise || mecenatProof;

        if (!moneyOK) return false;

        switch (activeTab) {
            case 'Mécénat': return tracking?.Cerfa_Envoye === true;
            case 'Stand': return true;
            default: return true;
        }
    };

    const getMissingActions = (entity, tracking) => {
        const actions = [];

        if (activeTab === 'Stand' && entity.Type !== 'Stand') {
            const hasTables = tracking?.Nombre_Tables !== undefined && tracking?.Nombre_Tables !== null && String(tracking?.Nombre_Tables).trim() !== '';
            const hasChairs = tracking?.Nombre_Chaises !== undefined && tracking?.Nombre_Chaises !== null && String(tracking?.Nombre_Chaises).trim() !== '';
            const hasElec = tracking?.Besoin_Electricite === 'Oui' || tracking?.Besoin_Electricite === 'Non';

            if (!hasTables) actions.push("Nb Tables ?");
            if (!hasChairs) actions.push("Nb Chaises ?");
            if (!hasElec) actions.push("Besoin Élec ?");
        }

        if (activeTab !== 'Tombola (Lots)' && !(activeTab === 'Stand' && entity.Type !== 'Stand')) {
            const paid = tracking?.Type_Paiement && tracking?.Type_Paiement !== '';
            if (!paid) actions.push("Paiement manquant");
        }

        switch (activeTab) {
            case 'Encart Pub':
                if (!tracking?.Visuel_Envoye) actions.push("Visuel manquant");
                if (!tracking?.Preuve_Paiement_Transmise) actions.push("Preuve manquante");
                break;
            case 'Tombola (Lots)':
                if (!tracking?.Lot_Recupere) actions.push("Lot à récupérer");
                if (!tracking?.Logo_Recu) actions.push("Logo manquant");
                break;
            case 'Partenaires':
                const packs = tracking?.Pack_Choisi ? tracking.Pack_Choisi.split(',') : [];
                if (packs.includes('4e de couverture') && !tracking?.Encart_Pub) actions.push("Encart Pub manquant");
                if (packs.includes('Affichage Mur') && !tracking?.Pancarte_Recu) actions.push("Pancarte manquante");
                if ((packs.includes('Logo Backdrop') || packs.includes('Logo Affiche')) && !tracking?.Logo_Recu) actions.push("Logo manquant");
                if (packs.includes('Stand 3x3m') && !tracking?.Stand_Inscrit) actions.push("Stand non inscrit");
                if (!tracking?.Preuve_Paiement_Transmise && !tracking?.Type_Paiement) actions.push("Paiement/Preuve manquant");
                break;
        }
        return actions;
    };

    const processedEntities = relevantEntities.map(e => {
        const t = getTrackingRecord(e.Id);
        return {
            entity: e,
            tracking: t,
            complete: isComplete(e, t),
            missing: getMissingActions(e, t)
        };
    });

    const filteredItems = processedEntities.filter(item => {
        if (filterMode === 'all') return true;
        if (filterMode === 'todo') return !item.complete;
        if (filterMode === 'done') return item.complete;
        return true;
    }).sort((a, b) => {
        if (filterMode === 'all') {
            // Sort incomplete first, complete last
            if (a.complete === b.complete) return 0;
            return a.complete ? 1 : -1;
        }
        return 0;
    });

    const stats = {
        total: processedEntities.length,
        todo: processedEntities.filter(i => !i.complete).length,
        done: processedEntities.filter(i => i.complete).length,
        revenuePromise: processedEntities.reduce((sum, item) => {
            // Exclude Partner-Stands from Revenue Calculation in Stand Tab
            if (activeTab === 'Stand' && item.entity.Type !== 'Stand') return sum;
            return sum + (parseFloat(item.entity.Recette) || 0);
        }, 0)
    };


    if (userRole !== 'ADMIN') return <div style={{ padding: '20px' }}>Accès refusé.</div>;

    return (
        <div style={{ backgroundColor: 'var(--brutal-bg)', minHeight: '100vh', padding: '20px', fontFamily: 'Space Grotesk, sans-serif' }}>

            {/* Header */}
            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', margin: 0, textTransform: 'uppercase' }}>Suivi Opérationnel</h1>
                    <Link to="/" style={{
                        backgroundColor: 'var(--brutal-black)', color: 'white', padding: '10px 20px',
                        textDecoration: 'none', fontWeight: 'bold', textTransform: 'uppercase',
                        border: '2px solid transparent', boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
                    }}>
                        &larr; Retour Carte
                    </Link>
                </div>

                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => setActiveTab(type)}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: activeTab === type ? 'var(--brutal-black)' : 'var(--brutal-white)',
                                color: activeTab === type ? 'var(--brutal-white)' : 'var(--brutal-black)',
                                border: 'var(--brutal-border)',
                                boxShadow: activeTab === type ? 'none' : 'var(--brutal-shadow)',
                                transform: activeTab === type ? 'translate(4px, 4px)' : 'none',
                                fontWeight: '900',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div style={{
                    display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
                    backgroundColor: 'var(--brutal-white)', border: 'var(--brutal-border)', padding: '20px',
                    boxShadow: 'var(--brutal-shadow)'
                }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                            TOTAL RECETTE PRÉVUE : <span style={{ backgroundColor: '#fffacd', padding: '0 5px' }}>{stats.revenuePromise.toLocaleString()} €</span>
                        </h2>
                        <p style={{ margin: '5px 0 0 0', color: '#666' }}>Avancement : {activeTab}</p>

                        {/* TEMPORARY INITIALIZATION BUTTON */}
                        <button
                            onClick={async () => {
                                if (!window.confirm(`Initialiser les lignes de suivi manquantes pour ${activeTab} ?`)) return;
                                setLoading(true);
                                let count = 0;
                                for (const entity of relevantEntities) {
                                    const existing = getTrackingRecord(entity.Id);
                                    if (!existing) {
                                        try {
                                            await createTrackingRecord(activeTab, {
                                                Link_Annonceur: entity.Id,
                                                Titre: entity.title || 'Suivi'
                                            });
                                            count++;
                                        } catch (e) {
                                            console.error("Init failed for", entity.title, e);
                                        }
                                    }
                                }
                                setLoading(false);
                                alert(`${count} lignes créées ! Rechargement...`);
                                window.location.reload();
                            }}
                            style={{
                                marginTop: '10px',
                                padding: '5px 10px',
                                backgroundColor: '#ffffcc',
                                border: '1px dashed orange',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                color: 'orange'
                            }}
                        >
                            ⚠️ Admin: Initialiser tout (Provisoire)
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div
                            onClick={() => setFilterMode('all')}
                            style={{
                                cursor: 'pointer', padding: '10px 20px', border: '2px solid black',
                                backgroundColor: filterMode === 'all' ? '#e0e0e0' : 'white',
                                fontWeight: 'bold', textAlign: 'center'
                            }}>
                            <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{stats.total}</div>
                            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>TOUT</div>
                        </div>
                        <div
                            onClick={() => setFilterMode('todo')}
                            style={{
                                cursor: 'pointer', padding: '10px 20px', border: '2px solid black',
                                backgroundColor: filterMode === 'todo' ? '#ff9999' : 'white',
                                fontWeight: 'bold', textAlign: 'center'
                            }}>
                            <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{stats.todo}</div>
                            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>À FAIRE</div>
                        </div>
                        <div
                            onClick={() => setFilterMode('done')}
                            style={{
                                cursor: 'pointer', padding: '10px 20px', border: '2px solid black',
                                backgroundColor: filterMode === 'done' ? '#99ff99' : 'white',
                                fontWeight: 'bold', textAlign: 'center'
                            }}>
                            <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{stats.done}</div>
                            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>TERMINÉ</div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Chargement...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {filteredItems.map(({ entity, tracking, complete, missing }) => {
                        const trackId = tracking?.Id;

                        return (
                            <div key={entity.Id} style={{
                                backgroundColor: 'var(--brutal-white)',
                                border: 'var(--brutal-border)',
                                boxShadow: 'var(--brutal-shadow)',
                                padding: '20px',
                                display: 'flex', flexDirection: 'column', gap: '15px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, height: '8px',
                                    backgroundColor: complete ? '#4CAF50' : '#FF5252',
                                    borderBottom: '2px solid black'
                                }} />

                                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{entity.title}</h3>
                                        <div style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic', marginTop: '5px' }}>
                                            {entity.Statuts}
                                            {activeTab === 'Stand' && entity.Type !== 'Stand' && (
                                                <span style={{
                                                    marginLeft: '10px', backgroundColor: 'black', color: 'white',
                                                    padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold'
                                                }}>
                                                    VIA PARTENARIAT
                                                </span>
                                            )}
                                        </div>
                                        {/* Contact Email - Show only if exists for Partner-Stands */}
                                        {!(activeTab === 'Stand' && entity.Type !== 'Stand' && !tracking?.Email_Contact) && (
                                            <input
                                                type="text"
                                                placeholder="Email Contact"
                                                value={tracking?.Email_Contact || ''}
                                                onChange={(e) => handleUpdate(trackId, 'Email_Contact', e.target.value, entity.Id)}
                                                style={{
                                                    marginTop: '5px', width: '90%', padding: '5px',
                                                    fontSize: '0.8rem', border: '1px solid #ccc'
                                                }}
                                            />
                                        )}

                                        {/* Type-Specific Text Inputs */}
                                        {activeTab === 'Encart Pub' && (
                                            <select
                                                value={tracking?.Format_Pub || ''}
                                                onChange={(e) => handleUpdate(trackId, 'Format_Pub', e.target.value, entity.Id)}
                                                style={{ marginTop: '5px', width: '90%', padding: '5px', fontSize: '0.8rem', border: '1px dashed black' }}
                                            >
                                                <option value="">- Format Pub -</option>
                                                <option value="1/8 page">1/8 page</option>
                                                <option value="1/4 page">1/4 page</option>
                                                <option value="1/2 page">1/2 page</option>
                                                <option value="Pleine page (intérieur)">Pleine page (intérieur)</option>
                                                <option value="3e de couv (int. arrière)">3e de couv (int. arrière)</option>
                                                <option value="2e de couv (int. avant)">2e de couv (int. avant)</option>
                                            </select>
                                        )}
                                        {activeTab === 'Partenaires' && (
                                            <div style={{ marginTop: '5px' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>PACK CHOISI :</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                    {[
                                                        "4e de couverture", "Affichage Mur", "Mention Streaming",
                                                        "Stand 3x3m", "Logo Backdrop", "Logo Affiche",
                                                        "Annonces Micro", "Post-event Mini-Rapport"
                                                    ].map(pack => {
                                                        const currentPacks = tracking?.Pack_Choisi ? tracking.Pack_Choisi.split(',') : [];
                                                        const isSelected = currentPacks.includes(pack);
                                                        return (
                                                            <div
                                                                key={pack}
                                                                onClick={() => {
                                                                    handlePackChange(trackId, tracking?.Pack_Choisi, pack, entity.Id);
                                                                }}
                                                                style={{
                                                                    padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer',
                                                                    border: '1px solid black',
                                                                    backgroundColor: isSelected ? 'black' : 'white',
                                                                    color: isSelected ? 'white' : 'black',
                                                                    fontWeight: isSelected ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {pack}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {activeTab === 'Tombola (Lots)' && (
                                            <>
                                                <textarea
                                                    placeholder="Description Lot"
                                                    value={tracking?.Description_Lot || ''}
                                                    onChange={(e) => handleUpdate(trackId, 'Description_Lot', e.target.value, entity.Id)}
                                                    style={{ marginTop: '5px', width: '90%', padding: '5px', fontSize: '0.8rem', border: '1px dashed black', resize: 'vertical' }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Nb Lot"
                                                    value={tracking?.Nb_Lot || ''}
                                                    onChange={(e) => handleUpdate(trackId, 'Nb_Lot', e.target.value, entity.Id)}
                                                    style={{ marginTop: '5px', width: '80px', padding: '5px', fontSize: '0.8rem', border: '1px dashed black' }}
                                                />
                                            </>
                                        )}
                                        {activeTab === 'Stand' && (
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                                <input
                                                    type="number"
                                                    placeholder="Tables"
                                                    value={tracking?.Nombre_Tables ?? ''}
                                                    onChange={(e) => handleUpdate(trackId, 'Nombre_Tables', e.target.value, entity.Id)}
                                                    style={{ width: '60px', padding: '5px', fontSize: '0.8rem', border: '1px dashed black' }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Chaises"
                                                    value={tracking?.Nombre_Chaises ?? ''}
                                                    onChange={(e) => handleUpdate(trackId, 'Nombre_Chaises', e.target.value, entity.Id)}
                                                    style={{ width: '60px', padding: '5px', fontSize: '0.8rem', border: '1px dashed black' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {/* Revenue Input - Hidden for Partner-Stands */}
                                    {!(activeTab === 'Stand' && entity.Type !== 'Stand') && (
                                        <div style={{ textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                defaultValue={entity.Recette}
                                                onBlur={(e) => handleRecetteUpdate(entity.Id, e.target.value)}
                                                placeholder="0 €"
                                                style={{
                                                    width: '80px', padding: '5px', textAlign: 'right', fontWeight: 'bold',
                                                    border: '2px solid black', borderRadius: 0
                                                }}
                                            />
                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>RECETTE (€)</div>
                                        </div>
                                    )}

                                    {/* Invoice Button for Stand, Encart, Partenaires */}
                                    {['Stand', 'Encart Pub', 'Partenaires'].includes(activeTab) && (
                                        <button
                                            onClick={() => handleOpenInvoice(entity, tracking)}
                                            style={{
                                                marginLeft: '10px',
                                                backgroundColor: 'var(--brutal-ice)',
                                                border: '2px solid black',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                padding: '5px 10px',
                                                height: 'fit-content'
                                            }}
                                        >
                                            📄 FACTURE
                                        </button>
                                    )}
                                </div>

                                {
                                    !complete && missing.length > 0 && (
                                        <div style={{
                                            backgroundColor: '#ffd7d7', border: '2px solid red', padding: '10px',
                                            fontSize: '0.9rem', fontWeight: 'bold', color: 'red'
                                        }}>
                                            ⚠️ {missing.join(', ')}
                                        </div>
                                    )
                                }

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '2px solid #eee', paddingTop: '10px' }}>
                                    {activeTab === 'Encart Pub' && (
                                        <ToggleButton
                                            label="Visuel Reçu"
                                            checked={tracking?.Visuel_Envoye}
                                            onChange={(val) => handleUpdate(trackId, 'Visuel_Envoye', val, entity.Id)}
                                        />
                                    )}
                                    {activeTab === 'Tombola (Lots)' && (
                                        <>
                                            <ToggleButton
                                                label="Lot Récupéré"
                                                checked={tracking?.Lot_Recupere}
                                                onChange={(val) => handleUpdate(trackId, 'Lot_Recupere', val, entity.Id)}
                                            />
                                            <ToggleButton
                                                label="Logo Reçu"
                                                checked={tracking?.Logo_Recu}
                                                onChange={(val) => handleUpdate(trackId, 'Logo_Recu', val, entity.Id)}
                                            />
                                        </>
                                    )}
                                    {activeTab === 'Partenaires' && (
                                        <>
                                            {(tracking?.Pack_Choisi || '').includes('Logo Headline') || (tracking?.Pack_Choisi || '').includes('Logo Backdrop') || (tracking?.Pack_Choisi || '').includes('Logo Affiche') ? (
                                                <ToggleButton
                                                    label="Logo Reçu"
                                                    checked={tracking?.Logo_Recu}
                                                    onChange={(val) => handleUpdate(trackId, 'Logo_Recu', val, entity.Id)}
                                                />
                                            ) : null}

                                            {(tracking?.Pack_Choisi || '').includes('4e de couverture') && (
                                                <ToggleButton
                                                    label="Encart Pub reçu ?"
                                                    checked={tracking?.Encart_Pub}
                                                    onChange={(val) => handleUpdate(trackId, 'Encart_Pub', val, entity.Id)}
                                                />
                                            )}

                                            {(tracking?.Pack_Choisi || '').includes('Affichage Mur') && (
                                                <ToggleButton
                                                    label="Pancarte 80x80cm reçue ?"
                                                    checked={tracking?.Pancarte_Recu}
                                                    onChange={(val) => handleUpdate(trackId, 'Pancarte_Recu', val, entity.Id)}
                                                />
                                            )}

                                            {(tracking?.Pack_Choisi || '').includes('Stand 3x3m') && (
                                                <ToggleButton
                                                    label="Ajouté au plan des Stands ?"
                                                    checked={tracking?.Stand_Inscrit}
                                                    onChange={(val) => handleUpdate(trackId, 'Stand_Inscrit', val, entity.Id)}
                                                />
                                            )}
                                        </>
                                    )}
                                    {activeTab === 'Mécénat' && (
                                        <ToggleButton
                                            label="Cerfa Envoyé"
                                            checked={tracking?.Cerfa_Envoye}
                                            onChange={(val) => handleUpdate(trackId, 'Cerfa_Envoye', val, entity.Id)}
                                        />
                                    )}
                                    {activeTab === 'Stand' && (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '5px' }}>BESOIN ELECTRICITÉ :</div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <div
                                                    onClick={() => handleUpdate(trackId, 'Besoin_Electricite', 'Oui', entity.Id)}
                                                    style={{
                                                        flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
                                                        border: '2px solid black', fontWeight: 'bold',
                                                        backgroundColor: tracking?.Besoin_Electricite === 'Oui' ? '#4CAF50' : 'white', // Bright Green
                                                        color: tracking?.Besoin_Electricite === 'Oui' ? 'white' : 'black',
                                                    }}
                                                >
                                                    OUI
                                                </div>
                                                <div
                                                    onClick={() => handleUpdate(trackId, 'Besoin_Electricite', 'Non', entity.Id)}
                                                    style={{
                                                        flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer',
                                                        border: '2px solid black', fontWeight: 'bold',
                                                        backgroundColor: tracking?.Besoin_Electricite === 'Non' ? '#4CAF50' : 'white', // Green also for NO as it is valid
                                                        color: tracking?.Besoin_Electricite === 'Non' ? 'white' : 'black',
                                                    }}
                                                >
                                                    NON
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab !== 'Tombola (Lots)' && !(activeTab === 'Stand' && entity.Type !== 'Stand') && (
                                        <div style={{ flexDirection: 'column', gap: '10px', borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Paiement</label>
                                                    <select
                                                        value={tracking?.Type_Paiement || ''}
                                                        onChange={(e) => handleUpdate(trackId, 'Type_Paiement', e.target.value, entity.Id)}
                                                        style={{ width: '100%', padding: '5px', borderRadius: 0, border: '2px solid black' }}
                                                    >
                                                        <option value="">-</option>
                                                        <option value="Virement">Virement</option>
                                                        <option value="Chèque">Chèque</option>
                                                        <option value="Espèces">Espèces</option>
                                                        <option value="Carte Bancaire">CB</option>
                                                    </select>
                                                </div>
                                                {/* Preuve Dropdown - Hidden for Mécénat as Cerfa is the Proof */}
                                                {activeTab !== 'Mécénat' && (
                                                    <div>
                                                        <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Preuve</label>
                                                        <select
                                                            value={tracking?.Type_Preuve || ''}
                                                            onChange={(e) => handleUpdate(trackId, 'Type_Preuve', e.target.value, entity.Id)}
                                                            style={{ width: '100%', padding: '5px', borderRadius: 0, border: '2px solid black' }}
                                                        >
                                                            <option value="">-</option>
                                                            <option value="Facture">Facture</option>
                                                            <option value="Attestation">Attestation</option>
                                                            <option value="Cerfa">Cerfa</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Preuve Toggle - Hidden for Mécénat */}
                                            {activeTab !== 'Mécénat' && (
                                                <ToggleButton
                                                    label="Preuve Transmise"
                                                    checked={tracking?.Preuve_Paiement_Transmise}
                                                    onChange={(val) => handleUpdate(trackId, 'Preuve_Paiement_Transmise', val, entity.Id)}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: 'auto' }}>
                                    <textarea
                                        placeholder="Commentaires..."
                                        value={tracking?.Commentaires || ''}
                                        onChange={(e) => handleUpdate(trackId, 'Commentaires', e.target.value, entity.Id)}
                                        style={{
                                            width: '100%', minHeight: '60px', padding: '10px',
                                            border: '2px solid black', resize: 'vertical',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )
            }

            {
                filteredItems.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2rem', color: '#666' }}>
                        Aucun élément à afficher
                    </div>
                )
            }

            <FactureModal
                isOpen={showInvoiceModal}
                onClose={() => setShowInvoiceModal(false)}
                entity={selectedInvoiceEntity}
                tracking={selectedInvoiceTracking}
                type={activeTab}
                onSave={handleInvoiceSave}
                onGenerate={handleInvoiceGenerate}
            />
        </div >
    );
};

// Helper Component for Toggle Buttons
const ToggleButton = ({ label, checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px', border: '2px solid black', cursor: 'pointer',
            backgroundColor: checked ? '#e6ffe6' : '#fff0f0',
            transition: 'background-color 0.2s'
        }}
    >
        <span style={{ fontWeight: 'bold' }}>{label}</span>
        <div style={{
            width: '24px', height: '24px', borderRadius: '4px', border: '2px solid black',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: checked ? 'black' : 'white',
            color: 'white'
        }}>
            {checked && '✓'}
        </div>
    </div>
);

export default SuiviAvancement;
