import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ReferentEntitiesList = ({ entities, referentName }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusColor = (status) => {
        switch (status) {
            case 'À contacter':
            case 'Sans réponse':
                return '#FFA500'; // Orange
            case 'En discussion':
                return '#3b82f6'; // Blue
            case 'Confirmé (en attente de paiement)':
            case 'Paiement effectué':
                return '#4ade80'; // Green
            case 'Refusé':
                return '#ef4444'; // Red
            default:
                return '#ffffff'; // White
        }
    };

    return (
        <div style={{ marginTop: '15px', borderTop: '2px solid black', paddingTop: '10px' }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--brutal-white)',
                    fontSize: '1rem'
                }}
            >
                <span>📋 Entités assignées ({entities.length})</span>
                <span>{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
                <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '5px'
                }}>
                    {entities.map(entity => (
                        <div key={entity.Id} style={{
                            border: '2px solid black',
                            padding: '10px',
                            backgroundColor: getStatusColor(entity.Statuts),
                            boxShadow: '3px 3px 0px black'
                        }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{entity.title}</div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
                                {entity.Statuts} - {entity.Type || 'Type non défini'}
                            </div>
                            <Link to={`/entity/${entity.Id}`} style={{
                                display: 'inline-block',
                                fontSize: '0.8rem',
                                textDecoration: 'underline',
                                color: 'black',
                                fontWeight: 'bold'
                            }}>
                                Voir la fiche →
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReferentEntitiesList;
