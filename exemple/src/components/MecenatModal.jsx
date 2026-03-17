import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const MecenatModal = ({ isOpen, onClose, entity, tracking, onSave, onGenerate }) => {
    const [formData, setFormData] = useState({
        Dénomination: '',
        Adresse: '',
        SIRET: '',
        Email: '',
        Montant: '',
        Forme_Juridique: '',
        Type_Paiement: '' // Read-only from tracking mostly
    });

    // Helper to parse DD/MM/YYYY to YYYY-MM-DD
    const parseDateToIso = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month}-${day}`;
        }
        return '';
    };

    useEffect(() => {
        if (isOpen && entity) {
            setFormData({
                Dénomination: tracking?.Facture_Nom || entity.title || '',
                Adresse: tracking?.Facture_Adresse || entity.address || '',
                SIRET: entity.Siret || '',
                Email: tracking?.Facture_Email || tracking?.Email_Contact || '',
                Montant: tracking?.Facture_Montant || entity.Recette || '',
                Forme_Juridique: entity.juridique || '', // Mapped to 'juridique' in Entity table
                Type_Paiement: tracking?.Type_Paiement || '',
                Date_Paiement: parseDateToIso(tracking?.date_paiement || tracking?.Date_Paiement || '')
            });
        }
    }, [isOpen, entity, tracking]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = () => {
        // Validation basic
        const required = ['Dénomination', 'Adresse', 'Email', 'Montant'];
        const missing = required.filter(field => !formData[field]);

        if (missing.length > 0) {
            alert(`Veuillez remplir les champs obligatoires : ${missing.join(', ')}`);
            return;
        }
        onGenerate(formData);
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 10001
        }}>
            <div style={{
                backgroundColor: 'var(--brutal-white)',
                padding: '30px',
                border: 'var(--brutal-border)',
                boxShadow: 'var(--brutal-shadow)',
                width: '90%',
                maxWidth: '600px', // slightly wider if needed
                maxHeight: '90vh',
                overflowY: 'auto',
                fontFamily: 'Space Grotesk, sans-serif'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem' }}>Reçu Mécénat (CERFA)</h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>

                    {/* Identification */}
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Dénomination de l'entreprise *</label>
                        <input
                            type="text"
                            name="Dénomination"
                            value={formData.Dénomination}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Forme Juridique</label>
                            <input
                                type="text"
                                name="Forme_Juridique"
                                placeholder="ex: SAS, SARL..."
                                value={formData.Forme_Juridique}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Numéro SIREN</label>
                            <input
                                type="text"
                                name="SIRET"
                                value={formData.SIRET}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    {/* Adresse */}
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Adresse Complète *</label>
                        <textarea
                            name="Adresse"
                            value={formData.Adresse}
                            onChange={handleChange}
                            placeholder="N°, Rue, Code Postal, Commune..."
                            rows={3}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                            Le découpage (N°, Rue, CP, Ville) sera effectué automatiquement.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Email Envoi *</label>
                            <input
                                type="email"
                                name="Email"
                                value={formData.Email}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Montant du Don (€) *</label>
                            <input
                                type="number"
                                name="Montant"
                                value={formData.Montant}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Date Paiement (Suivi)</label>
                        <input
                            type="date"
                            name="Date_Paiement"
                            value={formData.Date_Paiement || ''}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ backgroundColor: '#f0f0f0', padding: '10px', border: '1px dashed #999', marginTop: '10px' }}>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Informations Suivi (Lecture Seule)</label>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>Mode de versement :</span><br />
                                <strong>{formData.Type_Paiement || 'Non défini'}</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '10px' }}>
                        <button
                            onClick={handleGenerate}
                            style={{
                                width: '100%', padding: '15px', fontWeight: 'bold', cursor: 'pointer',
                                backgroundColor: '#4ade80', border: '2px solid black',
                                boxShadow: '4px 4px 0px black'
                            }}
                        >
                            ENREGISTRER & GÉNÉRER REÇU
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MecenatModal;
