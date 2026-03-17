import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEntities, fetchTrackingData, updateTrackingRecord } from '../services/api';

const BrochureAdmin = () => {
    const navigate = useNavigate();
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Local state to store user inputs for Page and Custom Filename
    // Structure: { [entityId]: { page: "5", customFilename: "my-file", position: "left" } }
    // We try to load from localStorage to persist simple data for OTHER fields (filename, etc)
    const [adminData, setAdminData] = useState(() => {
        const saved = localStorage.getItem('brochureAdminData');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        localStorage.setItem('brochureAdminData', JSON.stringify(adminData));
    }, [adminData]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [allEntities, partenairesRecords, encartPubRecords] = await Promise.all([
                fetchEntities(),
                fetchTrackingData('Partenaires'),
                fetchTrackingData('Encart Pub')
            ]);
            
            // Build Inverse Maps: EntityId -> LinkedRecord
            // Because the main entity doesn't have the link field, we look at the child's "Link_Annonceur"
            
            const entityToPartenaireMap = {};
            partenairesRecords.forEach(p => {
                if (p.Link_Annonceur && p.Link_Annonceur.Id) {
                    entityToPartenaireMap[p.Link_Annonceur.Id] = p;
                }
            });

            const entityToEncartMap = {};
            encartPubRecords.forEach(e => {
                if (e.Link_Annonceur && e.Link_Annonceur.Id) {
                    entityToEncartMap[e.Link_Annonceur.Id] = e;
                }
            });

            const validStatuses = ['Paiement effectué', 'Confirmé (en attente de paiement)'];

            const filtered = allEntities.filter(e => {
                const isStatusValid = validStatuses.includes(e.Statuts);
                if (!isStatusValid) return false;

                // 1. Check if this Entity ID exists in EncartPub Map
                if (entityToEncartMap[e.Id]) {
                    return true;
                }

                // 2. Check if this Entity ID exists in Partenaire Map AND has 4e de couverture
                const linkedPartenaire = entityToPartenaireMap[e.Id];
                if (linkedPartenaire) {
                    let packVal = linkedPartenaire.Pack_Choisi;
                    let searchStr = "";
                    if (Array.isArray(packVal)) {
                        searchStr = packVal.join(" ").toLowerCase();
                    } else if (typeof packVal === 'string') {
                        searchStr = packVal.toLowerCase();
                    }
                    
                    if (searchStr.includes('4e de couverture') || searchStr.includes('quatrième de couverture')) {
                        return true;
                    }
                }
                
                return false;
            });
            // (Previous sorting by status removed)
            
            // Prepare updates for adminData based on DB info
            const newAdminDataUpdates = {};

            filtered.forEach(e => {
                const id = e.Id;
                const existingData = adminData[id] || {};
                
                let derivedSize = null;
                let hasVisual = false;
                let dbPage = null;
                let trackingId = null;
                let trackingType = null;
                
                // From Encart Pub
                if (entityToEncartMap[e.Id]) {
                    const encart = entityToEncartMap[e.Id];
                    // Correct Field: Visuel_Envoye (Boolean)
                    if (encart.Visuel_Envoye) hasVisual = true;

                    if (encart.Format_Pub) {
                        const dbFormat = encart.Format_Pub.toLowerCase();
                        if (dbFormat.includes('1/8')) derivedSize = '1/8';
                        else if (dbFormat.includes('1/4')) derivedSize = '1/4';
                        else if (dbFormat.includes('1/2')) derivedSize = '1/2';
                        else if (dbFormat.includes('page') || dbFormat.includes('entier') || dbFormat.includes('full')) derivedSize = '1/1';
                    }
                    
                    if (encart.Page_Brochure) dbPage = encart.Page_Brochure;
                    trackingId = encart.Id;
                    trackingType = 'Encart Pub';
                }
                
                // From Partenaire (4e de couv)
                if (entityToPartenaireMap[e.Id]) {
                    const part = entityToPartenaireMap[e.Id];
                    // Correct Field: Logo_Recu (Boolean)
                    if (part.Logo_Recu) hasVisual = true;

                    derivedSize = '1/2';
                    
                    if (part.Page_Brochure) dbPage = part.Page_Brochure;
                    trackingId = part.Id;
                    trackingType = 'Partenaires';
                }
                
                // Attach visual status and tracking info to entity for local usage
                e._hasVisual = hasVisual;
                e._trackingId = trackingId;
                e._trackingType = trackingType;

                // Sync Page & Size logic
                const updates = {};
                let hasUpdate = false;

                // Size sync
                if (derivedSize && existingData.size !== derivedSize) {
                    updates.size = derivedSize;
                    hasUpdate = true;
                }
                
                // Page sync (DB wins if present)
                if (dbPage !== null && dbPage !== undefined) {
                    const dbPageStr = String(dbPage);
                    if (existingData.page !== dbPageStr) {
                        updates.page = dbPageStr;
                        hasUpdate = true;
                    }
                }

                if (hasUpdate) {
                    newAdminDataUpdates[id] = {
                        ...existingData,
                        ...updates
                    };
                }
            });
            
            if (Object.keys(newAdminDataUpdates).length > 0) {
                setAdminData(prev => {
                    const next = { ...prev };
                    for (const [id, up] of Object.entries(newAdminDataUpdates)) {
                        next[id] = up;
                    }
                    return next;
                });
            }

            setEntities(filtered);
        } catch (error) {
            console.error("Failed to load entities", error);
        } finally {
            setLoading(false);
        }
    };

    // Derived state for sorting: 
    // Group 1: !hasPage AND hasVisual (Yellow - Ready to Validate)
    // Group 2: !hasPage AND !hasVisual (Orange - Missing Info) -> User asked "entre ceux a valider et ceux validé"?
    // User Quote: "si pas de visuel = fond orange, dans un troisieme groupe situé netre ceux a valide et ceux validé ?"
    // "Ceux a valide" = Yellow (Top). "Ceux validé" = Green (Bottom).
    // So Orange is Middle.
    // Order:
    // 1. Ready (Yellow) (!Page, Visual OK)
    // 2. Missing Visual (Orange) (!Page, No Visual)
    // 3. Validated (Green) (Page OK)
    
    const sortedEntities = React.useMemo(() => {
        return [...entities].sort((a, b) => {
            const idA = a.Id;
            const idB = b.Id;
            
            const dataA = adminData[idA] || {};
            const dataB = adminData[idB] || {};
            
            const hasPageA = dataA.page && dataA.page.trim() !== '';
            const hasPageB = dataB.page && dataB.page.trim() !== '';
            
            // 1. Grouping Logic
            // We assign a score:
            // 0: Ready (Yellow) -> !hasPage && a._hasVisual
            // 1: Missing Visual (Orange) -> !hasPage && !a._hasVisual
            // 2: Validated (Green) -> hasPage
            
            const getScore = (ent, hasPage) => {
                if (hasPage) return 2;
                if (ent._hasVisual) return 0;
                return 1; 
            };
            
            const scoreA = getScore(a, hasPageA);
            const scoreB = getScore(b, hasPageB);
            
            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }
            
            // Si les deux sont validés (Score 2), on trie par numéro de page
            if (scoreA === 2) {
                const pageA = parseInt(dataA.page, 10) || 0;
                const pageB = parseInt(dataB.page, 10) || 0;
                if (pageA !== pageB) {
                    return pageA - pageB;
                }
            }
            
            // Secondary Sort: Alphabetical Title
            const titleA = (a.title || "").toLowerCase();
            const titleB = (b.title || "").toLowerCase();
            
            if (titleA < titleB) return -1;
            if (titleA > titleB) return 1;
            return 0;
        });
    }, [entities, adminData]);

    const handlePageSave = async (entity, value) => {
        const type = entity._trackingType;
        const id = entity._trackingId;
        
        if (!type || !id) return;
        
        try {
            // value is string, DB expects number
            let num = parseInt(value, 10);
            
            // Handle empty string as null (deletion)
            if (value === '' || value === null || value === undefined) {
                 num = null;
            } else if (isNaN(num)) {
                 // Invalid number, maybe don't save?
                 return;
            }

            console.log(`Saving Page ${num} for ${type} ${id}`);
            // Note: NocoDB API v2 update strictly requires the ID in the body as well for bulk/patch
            await updateTrackingRecord(type, id, { Page_Brochure: num });
            
        } catch (error) {
            console.error("Failed to save page", error);
            alert("Erreur lors de la sauvegarde du numéro de page !");
        }
    };

    const handleDataChange = (id, field, value) => {
        setAdminData(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const generateFilename = (entity, id) => {
        const custom = adminData[id]?.customFilename;
        if (custom) return custom;
        
        let name = entity.title || "sans-titre";
        return name.toLowerCase()
            .replace(/\s+/g, '-')       // Replace spaces with -
            .replace(/[^a-z0-9-]/g, ''); // Remove non-alphanumeric chars except -
    };

    const generateCode = (entity) => {
        const id = entity.Id;
        const data = adminData[id] || {};
        const filename = generateFilename(entity, id);
        const size = data.size || "1/4"; // Default
        const extension = data.extension || ".jpg";
        const rotation = data.rotation || ""; // Default no rotation

        const title = entity.title || "Publicité";
        const imgClass = `ad-img ${rotation}`.trim();

        if (size === "1/1") {
             // Pas de conteneur spécifique pour 1/1
             return `<img src="pub/1/${filename}${extension}" alt="${title}" class="${imgClass}" style="width:100%; height:100%; object-fit:cover;" />`;
        }
        
        if (size === "1/8") {
             // 1/8 Logic - Conteneur cols2
             return `<!-- 1 ligne : 2 pub 1/8 -->
<div class="cols2">
  <img src="pub/0.125/${filename}${extension}" alt="${title}" class="${imgClass}">
</div>`;
        }

        if (size === "1/4") {
            return `<img src="pub/0.25/${filename}${extension}" alt="${title}" class="${imgClass}">`;
        }

        if (size === "1/2") {
            return `<img src="pub/0.5/${filename}${extension}" alt="${title}" class="${imgClass}">`;
        }
        
        return "<!-- Format inconnu -->";
    };

    // Metrics Calculation
    const total = sortedEntities.length;
    const validated = sortedEntities.filter(e => {
        const data = adminData[e.Id] || {};
        return data.page && data.page.trim() !== '';
    }).length;
    
    // Logic matches the sort/color logic
    const ready = sortedEntities.filter(e => {
        const data = adminData[e.Id] || {};
        const hasPage = data.page && data.page.trim() !== '';
        return !hasPage && e._hasVisual;
    }).length;
    
    const missing = sortedEntities.filter(e => {
        const data = adminData[e.Id] || {};
        const hasPage = data.page && data.page.trim() !== '';
        return !hasPage && !e._hasVisual;
    }).length;

    // Detailed Stats Calculation
    const stats = {
        '1/8': { total: 0, validated: 0 },
        '1/4': { total: 0, validated: 0 },
        '1/2': { total: 0, validated: 0 },
        '1/1': { total: 0, validated: 0 }
    };

    sortedEntities.forEach(e => {
        const data = adminData[e.Id] || {};
        const size = data.size || "1/4";
        const isValidated = data.page && data.page.trim() !== '';
        
        if (stats[size]) {
            stats[size].total++;
            if (isValidated) stats[size].validated++;
        }
    });

    const totalPagesEquivalent = (
        (stats['1/8'].total * 0.125) +
        (stats['1/4'].total * 0.25) +
        (stats['1/2'].total * 0.5) +
        (stats['1/1'].total * 1)
    );

    if (loading) return <div style={{padding: '20px'}}>Chargement...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '4px solid black' }}>
                <h1 style={{ fontSize: '2rem', margin: 0 }}>
                    Administration Brochure
                </h1>
                <button 
                    onClick={() => navigate('/')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: 'black',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                    }}
                >
                    ← Retour Carte
                </button>
            </div>
            
            {/* Summary Dashboard */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <div style={{ flex: 1, padding: '15px', border: '1px solid #000', backgroundColor: '#f9f9f9' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{total}</div>
                    <div style={{ fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Encarts</div>
                </div>
                <div style={{ flex: 1, padding: '15px', border: '1px solid #000', backgroundColor: 'rgba(0, 255, 0, 0.2)' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{validated}</div>
                    <div style={{ fontSize: '0.9rem', textTransform: 'uppercase' }}>Validés (Vert)</div>
                </div>
                <div style={{ flex: 1, padding: '15px', border: '1px solid #000', backgroundColor: 'rgba(255, 255, 0, 0.2)' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{ready}</div>
                    <div style={{ fontSize: '0.9rem', textTransform: 'uppercase' }}>Prêts (Jaune)</div>
                </div>
                <div style={{ flex: 1, padding: '15px', border: '1px solid #000', backgroundColor: 'rgba(255, 165, 0, 0.3)' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{missing}</div>
                    <div style={{ fontSize: '0.9rem', textTransform: 'uppercase' }}>Visuel Manquant (Orange)</div>
                </div>
            </div>

            {/* Detailed Stats Breakdown */}
            <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #000', backgroundColor: '#fff' }}>
                <h3 style={{ marginTop: 0 }}>Détail par format</h3>
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                        <strong>1/8 :</strong> {stats['1/8'].total} <span style={{color: 'green'}}>({stats['1/8'].validated} validés)</span>
                    </div>
                    <div>
                        <strong>1/4 :</strong> {stats['1/4'].total} <span style={{color: 'green'}}>({stats['1/4'].validated} validés)</span>
                    </div>
                    <div>
                        <strong>1/2 :</strong> {stats['1/2'].total} <span style={{color: 'green'}}>({stats['1/2'].validated} validés)</span>
                    </div>
                    <div>
                        <strong>1/1 :</strong> {stats['1/1'].total} <span style={{color: 'green'}}>({stats['1/1'].validated} validés)</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        Total Équivalent Pages : {Number(totalPagesEquivalent)}
                    </div>
                </div>
            </div>

            <p style={{marginBottom: '20px'}}>
                Outil de suivi pour l'intégration des encarts publicitaires.
                Les numéros de page sont sauvegardés directement dans la base de données.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
                <thead style={{ backgroundColor: 'black', color: 'white' }}>
                    <tr>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Page</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Entité / Statut</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Configuration Fichier</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Code HTML</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedEntities.map(entity => {
                        const id = entity.Id;
                        const data = adminData[id] || {};
                        const hasPage = data.page && data.page.trim() !== '';
                        
                        // Color Logic:
                        // Green: Has Page (Done)
                        // Orange: No Page & No Visual (Missing Info)
                        // Yellow: No Page & Has Visual (Ready)
                        let rowColor = 'rgba(255, 255, 0, 0.2)'; // Default Yellow
                        if (hasPage) {
                            rowColor = 'rgba(0, 255, 0, 0.2)'; // Green
                        } else if (!entity._hasVisual) {
                            rowColor = 'rgba(255, 165, 0, 0.3)'; // Orange
                        }
                        
                        return (
                            <tr key={id} style={{ 
                                borderBottom: '1px solid #ccc',
                                backgroundColor: rowColor
                            }}>
                                <td style={{ padding: '10px', verticalAlign: 'top', width: '80px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="No." 
                                        value={data.page || ''}
                                        onChange={(e) => handleDataChange(id, 'page', e.target.value)}
                                        onBlur={(e) => handlePageSave(entity, e.target.value)}
                                        style={{ 
                                            width: '50px', 
                                            padding: '5px', 
                                            border: '2px solid black',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            backgroundColor: data.page ? '#ccffcc' : 'white'
                                        }}
                                    />
                                    {data.page && <div style={{fontSize: '0.8rem', color: 'green', marginTop: '5px'}}>✓ Validé</div>}
                                </td>
                                
                                <td style={{ padding: '10px', verticalAlign: 'top', width: '250px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{entity.title}</div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span style={{ 
                                            padding: '2px 6px', 
                                            backgroundColor: 'black', 
                                            color: 'white', 
                                            fontSize: '0.75rem',
                                            borderRadius: '4px'
                                        }}>
                                            {entity.Statuts}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{display: 'block', fontSize: '0.8rem', fontWeight: 'bold'}}>Format:</label>
                                        <select 
                                            value={data.size || "1/4"}
                                            disabled={true} // Disabled as requested
                                            onChange={(e) => handleDataChange(id, 'size', e.target.value)}
                                            style={{ width: '100%', padding: '5px', backgroundColor: '#e9e9e9', cursor: 'not-allowed' }}
                                        >
                                            <option value="1/8">1/8 Page</option>
                                            <option value="1/4">1/4 Page</option>
                                            <option value="1/2">1/2 Page</option>
                                            <option value="1/1">Pleine Page</option>
                                        </select>
                                    </div>
                                    

                                </td>

                                <td style={{ padding: '10px', verticalAlign: 'top', width: '250px' }}>
                                    <label style={{display: 'block', fontSize: '0.8rem', fontWeight: 'bold'}}>Nom Fichier Generated:</label>
                                    <input 
                                        type="text" 
                                        value={generateFilename(entity, id)}
                                        readOnly
                                        style={{ width: '100%', padding: '5px', backgroundColor: '#eee', border: '1px solid #ccc', marginBottom: '10px' }}
                                    />
                                    
                                    <label style={{display: 'block', fontSize: '0.8rem', fontWeight: 'bold'}}>Surcharge Nom Fichier:</label>
                                    <input 
                                        type="text" 
                                        value={data.customFilename || ''}
                                        placeholder="Ex: mon-fichier-final"
                                        onChange={(e) => handleDataChange(id, 'customFilename', e.target.value)}
                                        style={{ width: '100%', padding: '5px', border: '1px solid black', marginBottom: '10px' }}
                                    />

                                    <label style={{display: 'block', fontSize: '0.8rem', fontWeight: 'bold'}}>Extension:</label>
                                    <select 
                                        value={data.extension || ".jpg"}
                                        onChange={(e) => handleDataChange(id, 'extension', e.target.value)}
                                        style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
                                    >
                                        <option value=".jpg">.jpg</option>
                                        <option value=".png">.png</option>
                                        <option value=".jpeg">.jpeg</option>
                                    </select>

                                    <label style={{display: 'block', fontSize: '0.8rem', fontWeight: 'bold'}}>Rotation:</label>
                                    <select 
                                        value={data.rotation || ""}
                                        onChange={(e) => handleDataChange(id, 'rotation', e.target.value)}
                                        style={{ width: '100%', padding: '5px' }}
                                    >
                                        <option value="">Aucune</option>
                                        <option value="rot-p1">Rot +1.5° (p1)</option>
                                        <option value="rot-m1">Rot -1.5° (m1)</option>
                                        <option value="rot-p2">Rot +3° (p2)</option>
                                        <option value="rot-m2">Rot -3° (m2)</option>
                                    </select>
                                </td>

                                <td style={{ padding: '10px', verticalAlign: 'top' }}>
                                    <textarea 
                                        readOnly
                                        value={generateCode(entity)}
                                        style={{ 
                                            width: '100%', 
                                            height: '120px', 
                                            fontFamily: 'monospace', 
                                            fontSize: '0.85rem',
                                            padding: '10px',
                                            backgroundColor: '#f4f4f4',
                                            border: '1px solid #999'
                                        }}
                                        onClick={(e) => e.target.select()}
                                    />
                                    <div style={{ textAlign: 'right', marginTop: '5px' }}>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(generateCode(entity));
                                                alert('Code copié !');
                                            }}
                                            style={{
                                                backgroundColor: 'black',
                                                color: 'white',
                                                border: 'none',
                                                padding: '5px 10px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            Copier
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default BrochureAdmin;
