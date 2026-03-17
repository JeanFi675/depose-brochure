import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const FactureModal = ({ isOpen, onClose, entity, tracking, type, onSave, onGenerate }) => {
    const [formData, setFormData] = useState({
        Facture_Nom: '',
        Facture_Adresse: '',
        Facture_SIRET: '',
        Facture_Email: '',
        Facture_Montant: '',
        Facture_Description: ''
    });

    useEffect(() => {
        if (isOpen && entity) {
            let intelligentDescription = tracking?.Facture_Description || '';

            if (!intelligentDescription) {
                // Generate base description
                intelligentDescription = `Facturation pour ${entity.title}`;

                // Add specifics based on Type
                if (type === 'Encart Pub') {
                    const format = tracking?.Format_Pub || tracking?.Pack_Choisi || 'Format non spécifié';
                    intelligentDescription = `Encart Publicitaire - ${format}`;
                } else if (type === 'Partenaires') {
                    const packs = tracking?.Pack_Choisi || 'Aucun pack';
                    intelligentDescription = `Partenariat - Options: ${packs}`;
                } else if (type === 'Stand') {
                    const nbJour = tracking?.nb_jour || '?'; // User said they added 'nb_jour' field
                    intelligentDescription = `Stand - ${nbJour} jours`;
                }
            }

            setFormData({
                Facture_Nom: tracking?.Facture_Nom || entity.title || '',
                // Prefer saved invoice address, fallback to entity address
                Facture_Adresse: tracking?.Facture_Adresse || entity.address || '',
                Facture_SIRET: tracking?.Facture_SIRET || '',
                Facture_Email: tracking?.Facture_Email || tracking?.Email_Contact || '',
                Facture_Montant: tracking?.Facture_Montant || entity.Recette || '',
                Facture_Description: intelligentDescription
            });
        }
    }, [isOpen, entity, tracking, type]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(formData);
    };

    const handleGenerate = () => {
        onGenerate(formData);
    };

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 10001 // Higher than others
        }}>
            <div style={{
                backgroundColor: 'var(--brutal-white)',
                padding: '30px',
                border: 'var(--brutal-border)',
                boxShadow: 'var(--brutal-shadow)',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
                fontFamily: 'Space Grotesk, sans-serif'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem' }}>Facturation</h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <div style={{ display: 'grid', gap: '15px' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Nom / Raison Sociale</label>
                        <input
                            type="text"
                            name="Facture_Nom"
                            value={formData.Facture_Nom}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Adresse Complète</label>
                        <textarea
                            name="Facture_Adresse"
                            value={formData.Facture_Adresse}
                            onChange={handleChange}
                            placeholder="Rue, CP, Ville..."
                            style={{ width: '100%', padding: '10px', border: '2px solid black', minHeight: '80px', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>SIRET (Optionnel)</label>
                            <input
                                type="text"
                                name="Facture_SIRET"
                                value={formData.Facture_SIRET}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Email Envoi</label>
                            <input
                                type="email"
                                name="Facture_Email"
                                value={formData.Facture_Email}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Description</label>
                            <input
                                type="text"
                                name="Facture_Description"
                                value={formData.Facture_Description}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Montant HT (€)</label>
                            <input
                                type="number"
                                name="Facture_Montant"
                                value={formData.Facture_Montant}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '10px' }}>
                        <button
                            onClick={handleSave}
                            style={{
                                flex: 1, padding: '15px', fontWeight: 'bold', cursor: 'pointer',
                                backgroundColor: 'var(--brutal-ice)', border: '2px solid black',
                                boxShadow: '4px 4px 0px black'
                            }}
                        >
                            ENREGISTRER
                        </button>
                        <button
                            onClick={handleGenerate}
                            style={{
                                flex: 1, padding: '15px', fontWeight: 'bold', cursor: 'pointer',
                                backgroundColor: '#4ade80', border: '2px solid black',
                                boxShadow: '4px 4px 0px black'
                            }}
                        >
                            GÉNÉRER FACTURE
                        </button>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                        * Le numéro de facture sera généré automatiquement.
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FactureModal;
