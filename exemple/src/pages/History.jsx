import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchEntities } from '../services/api';

const History = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadHistory = async () => {
            const entities = await fetchEntities();
            const allLogs = [];

            entities.forEach(entity => {
                if (entity.Comments) {
                    const lines = entity.Comments.split('\n');
                    let currentLog = null;

                    lines.forEach(line => {
                        const match = line.match(/^\[(.+?)\]\s*(.*)$/);
                        if (match) {
                            if (currentLog) {
                                allLogs.push(currentLog);
                            }
                            currentLog = {
                                timestampStr: match[1],
                                text: match[2] || '',
                                entityTitle: entity.title,
                                entityId: entity.Id
                            };
                        } else if (currentLog && line.trim()) {
                            currentLog.text += '\n' + line;
                        }
                    });
                    if (currentLog) {
                        allLogs.push(currentLog);
                    }
                }
            });

            // Sort by date descending
            // Timestamp format is usually "DD/MM/YYYY HH:mm"
            allLogs.sort((a, b) => {
                const dateA = parseDate(a.timestampStr);
                const dateB = parseDate(b.timestampStr);
                return dateB - dateA;
            });

            setLogs(allLogs);
            setLoading(false);
        };

        loadHistory();
    }, []);

    const parseDate = (dateStr) => {
        try {
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hour, minute] = timePart.split(':');
            return new Date(year, month - 1, day, hour, minute);
        } catch (e) {
            return new Date(0); // Fallback
        }
    };

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement de l'historique...</div>;
    }

    return (
        <div className="history-container">
            <div className="history-content">
                <div className="history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <Link to="/" className="history-back-button" style={{
                        display: 'inline-block',
                        fontWeight: 'bold',
                        textDecoration: 'none',
                        border: 'var(--brutal-border)',
                        padding: '10px 20px',
                        boxShadow: 'var(--brutal-shadow)',
                        backgroundColor: 'var(--brutal-white)',
                        color: 'var(--brutal-black)'
                    }}>
                        ← Retour
                    </Link>
                    <h1 style={{ margin: 0 }}>Historique Global</h1>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {logs.length === 0 ? (
                        <p>Aucun historique disponible.</p>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} style={{
                                border: 'var(--brutal-border)',
                                boxShadow: 'var(--brutal-shadow)',
                                padding: '15px',
                                backgroundColor: '#fff'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#666' }}>{log.timestampStr}</span>
                                    <Link to={`/entity/${log.entityId}`} style={{ fontWeight: 'bold', color: 'var(--brutal-black)' }}>
                                        {log.entityTitle}
                                    </Link>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {log.text}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
