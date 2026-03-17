import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTrackingData } from '../services/api';

const BilanFinancier = ({ entities }) => {
    const [trackingData, setTrackingData] = useState({
        'Encart Pub': [],
        'Partenaires': [],
        'Mécénat': [],
        'Tombola (Lots)': []
    });
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [encartPub, partenaires, mecenat, tombola] = await Promise.all([
                    fetchTrackingData('Encart Pub'),
                    fetchTrackingData('Partenaires'),
                    fetchTrackingData('Mécénat'),
                    fetchTrackingData('Tombola (Lots)')
                ]);

                setTrackingData({
                    'Encart Pub': encartPub,
                    'Partenaires': partenaires,
                    'Mécénat': mecenat,
                    'Tombola (Lots)': tombola
                });
            } catch (error) {
                console.error("Erreur chargement données suivi:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // --- Helpers ---
    const getTrackingInfo = (type, entityId) => {
        const records = trackingData[type] || [];
        return records.find(r => {
            const link = r.Link_Annonceur;
            if (typeof link === 'object' && link !== null) {
                return String(link.Id) === String(entityId);
            }
            return String(link) === String(entityId);
        });
    };

    // --- Data Preparation ---
    const section1Types = ['Encart Pub', 'Partenaires', 'Mécénat', 'Stand'];
    const validStatuses = ['Confirmé (en attente de paiement)', 'Paiement effectué'];

    const itemsSection1 = entities.filter(e => 
        section1Types.includes(e.Type) && validStatuses.includes(e.Statuts)
    ).map(e => {
        const track = getTrackingInfo(e.Type, e.Id);
        let details = e.Type; 
        
        if (e.Type === 'Encart Pub' && track?.Format_Pub) {
            details += ` (${track.Format_Pub})`;
        } else if (e.Type === 'Partenaires' && track?.Pack_Choisi) {
            details += ` (${track.Pack_Choisi})`;
        }

        return {
            ...e,
            DisplayType: details,
            Montant: parseFloat(e.Recette) || 0
        };
    }).sort((a,b) => b.Montant - a.Montant);

    const totalSection1 = itemsSection1.reduce((sum, item) => sum + item.Montant, 0);

    const itemsSection2 = entities.filter(e => 
        e.Type === 'Subvention' && validStatuses.includes(e.Statuts)
    ).map(e => ({
        ...e,
        Montant: parseFloat(e.Recette) || 0
    }));

    const totalSection2 = itemsSection2.reduce((sum, item) => sum + item.Montant, 0);

    const itemsSection3 = entities.filter(e => 
        (e.Type === 'Tombola' || e.Type === 'Tombola (Lots)') && validStatuses.includes(e.Statuts)
    ).map(e => {
        const track = getTrackingInfo('Tombola (Lots)', e.Id);
        return {
            ...e,
            Description: track?.Description_Lot || 'N/A',
            Nombre: track?.Nb_Lot || 1,
            Valeur: parseFloat(e.Recette) || 0
        };
    });

    // --- UX Components ---

    // Card View for Mobile
    const CardItem = ({ title, details, rightValue, subtitle }) => (
        <div style={{
            border: '2px solid black',
            padding: '15px',
            marginBottom: '15px',
            backgroundColor: 'white',
            boxShadow: '4px 4px 0px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
                <span style={{ fontWeight: '900', fontSize: '1.1rem' }}>{rightValue}</span>
            </div>
            {subtitle && <div style={{ fontSize: '0.9rem', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}>{subtitle}</div>}
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                {details}
            </div>
        </div>
    );

    // Desktop Table View
    const TableView = ({ headers, widths, rows, renderRow }) => (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    {headers.map((h, i) => (
                        <th key={i} style={{
                            border: '2px solid black',
                            padding: '10px',
                            backgroundColor: 'black',
                            color: 'white',
                            textAlign: i === headers.length - 1 ? 'right' : (i === headers.length - 2 && headers.length > 2 ? 'center' : 'left'),
                            textTransform: 'uppercase',
                            width: widths[i]
                        }}>
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? rows.map(renderRow) : (
                    <tr><td colSpan={headers.length} style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic', border: '1px solid black' }}>Aucune donnée</td></tr>
                )}
            </tbody>
        </table>
    );

    // Styles
    const containerStyle = {
        backgroundColor: 'var(--brutal-bg, #f4f4f4)',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: 'Space Grotesk, sans-serif'
    };

    const contentWrapperStyle = {
        maxWidth: '1000px', // FIX: Largeur demandée
        margin: '0 auto',
        width: '100%'
    };
    
    const sectionStyle = {
        backgroundColor: 'white',
        border: '3px solid black',
        boxShadow: '8px 8px 0px rgba(0,0,0,1)',
        padding: isMobile ? '15px' : '20px',
        marginBottom: '40px'
    };

    const headerStyle = {
        borderBottom: '3px solid black',
        paddingBottom: '10px',
        marginBottom: '20px',
        fontSize: '1.5rem',
        textTransform: 'uppercase',
        fontWeight: '900',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
    };

    const totalStyle = {
        fontSize: '1.2rem',
        marginTop: '15px',
        textAlign: 'right',
        fontWeight: '900',
        backgroundColor: '#fffacd',
        padding: '10px',
        border: '2px solid black',
        display: 'inline-block',
        float: isMobile ? 'none' : 'right',
        width: isMobile ? '100%' : 'auto',
        boxSizing: 'border-box'
    };

    const tdStyle = {
        border: '1px solid black',
        padding: '10px',
        fontWeight: 'bold',
        verticalAlign: 'top'
    };

    return (
        <div style={containerStyle}>
            <div style={contentWrapperStyle}>
                <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <h1 style={{ fontSize: isMobile ? '2rem' : '2.5rem', margin: 0, textTransform: 'uppercase', textDecoration: 'underline' }}>
                        💰 Bilan Financier
                    </h1>
                    <Link to="/" style={{
                        backgroundColor: 'white', color: 'black', padding: '10px 20px',
                        textDecoration: 'none', fontWeight: 'bold', textTransform: 'uppercase',
                        border: '3px solid black', boxShadow: '4px 4px 0px black',
                        whiteSpace: 'nowrap', fontSize: isMobile ? '0.9rem' : '1rem'
                    }}>
                        &larr; Retour Carte
                    </Link>
                </div>

                {loading ? (
                    <div style={{fontSize: '2rem', fontWeight: 'bold'}}>Chargement des données...</div>
                ) : (
                    <>
                        {/* SECTION 1 */}
                        <div style={sectionStyle}>
                            <div style={headerStyle}>
                                <span>1. Partenariats / Annonceurs</span>
                            </div>
                            
                            {isMobile ? (
                                <div>
                                    {itemsSection1.map(item => (
                                        <CardItem 
                                            key={item.Id}
                                            title={item.title}
                                            rightValue={`${item.Montant.toLocaleString()} €`}
                                            details={item.DisplayType}
                                        />
                                    ))}
                                    {itemsSection1.length === 0 && <div style={{fontStyle: 'italic', textAlign: 'center'}}>Aucune donnée</div>}
                                </div>
                            ) : (
                                <TableView 
                                    headers={['Entité', 'Détail (Type/Format/Pack)', 'Montant (€)']}
                                    widths={['25%', '55%', '20%']}
                                    rows={itemsSection1}
                                    renderRow={(item) => (
                                        <tr key={item.Id}>
                                            <td style={tdStyle}>{item.title}</td>
                                            <td style={{...tdStyle, fontSize: '0.9rem'}}>{item.DisplayType}</td>
                                            <td style={{...tdStyle, textAlign: 'right'}}>{item.Montant.toLocaleString()} €</td>
                                        </tr>
                                    )}
                                />
                            )}
                            
                            <div style={{overflow: 'hidden'}}>
                                <div style={totalStyle}>
                                    TOTAL : {totalSection1.toLocaleString()} €
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2 */}
                        <div style={sectionStyle}>
                            <div style={headerStyle}>
                                <span>2. Subventions</span>
                            </div>

                            {isMobile ? (
                                <div>
                                    {itemsSection2.map(item => (
                                        <CardItem 
                                            key={item.Id}
                                            title={item.title}
                                            rightValue={`${item.Montant.toLocaleString()} €`}
                                            details="Subvention validée"
                                        />
                                    ))}
                                     {itemsSection2.length === 0 && <div style={{fontStyle: 'italic', textAlign: 'center'}}>Aucune donnée</div>}
                                </div>
                            ) : (
                                <TableView 
                                    headers={['Entité', 'Montant (€)']}
                                    widths={['70%', '30%']}
                                    rows={itemsSection2}
                                    renderRow={(item) => (
                                        <tr key={item.Id}>
                                            <td style={tdStyle}>{item.title}</td>
                                            <td style={{...tdStyle, textAlign: 'right'}}>{item.Montant.toLocaleString()} €</td>
                                        </tr>
                                    )}
                                />
                            )}

                            <div style={{overflow: 'hidden'}}>
                                <div style={totalStyle}>
                                    TOTAL : {totalSection2.toLocaleString()} €
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3 */}
                        <div style={sectionStyle}>
                            <div style={headerStyle}>
                                <span>3. Tombola</span>
                            </div>

                            {isMobile ? (
                                <div>
                                    {itemsSection3.map(item => (
                                        <CardItem 
                                            key={item.Id}
                                            title={item.title}
                                            rightValue={`Qté: ${item.Nombre}`}
                                            subtitle={item.Valeur > 0 ? `Val. Est.: ${item.Valeur} €` : null}
                                            details={item.Description}
                                        />
                                    ))}
                                     {itemsSection3.length === 0 && <div style={{fontStyle: 'italic', textAlign: 'center'}}>Aucune donnée</div>}
                                </div>
                            ) : (
                                <TableView 
                                    headers={['Entité', 'Description Lot', 'Quantité', 'Valeur Est. (€)']}
                                    widths={['25%', '45%', '15%', '15%']}
                                    rows={itemsSection3}
                                    renderRow={(item) => (
                                        <tr key={item.Id}>
                                            <td style={tdStyle}>{item.title}</td>
                                            <td style={{...tdStyle, fontSize: '0.9rem'}}>{item.Description}</td>
                                            <td style={{...tdStyle, textAlign: 'center'}}>{item.Nombre}</td>
                                            <td style={{...tdStyle, textAlign: 'right'}}>{item.Valeur > 0 ? item.Valeur.toLocaleString() + ' €' : '-'}</td>
                                        </tr>
                                    )}
                                />
                            )}

                            <div style={{overflow: 'hidden'}}>
                                <div style={{...totalStyle, backgroundColor: '#e0e0e0'}}>
                                    Nombre Total Lots : {itemsSection3.reduce((sum, i) => sum + parseInt(i.Nombre||0), 0)}
                                </div>
                            </div>
                        </div>

                        {/* GLOBAL TOTAL */}
                        <div style={{
                            marginTop: '50px', 
                            padding: '20px', 
                            backgroundColor: 'black', 
                            color: 'white', 
                            fontSize: isMobile ? '1.5rem' : '2rem', 
                            fontWeight: '900', 
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            border: '5px solid black',
                            boxShadow: '10px 10px 0px rgba(0,0,0,0.2)'
                        }}>
                            RECETTE TOTALE (HORS TOMBOLA) : <br/>{(totalSection1 + totalSection2).toLocaleString()} €
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BilanFinancier;
