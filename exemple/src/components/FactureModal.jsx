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
            let intelligentDescription = tracking?.Facture_Description || '';

            if (!intelligentDescription) {
                // Event Header
                const eventHeader = "Championnat de France d'escalade de difficultés jeunes\n16 et 17 Mai 2026 - SAINT PIERRE EN FAUCIGNY\n\n";

                // Add specifics based on Type
                let specifics = '';
                if (type === 'Encart Pub') {
                    const format = tracking?.Format_Pub || tracking?.Pack_Choisi || 'Format non spécifié';
                    specifics = `Encart Publicitaire - ${format}`;
                } else if (type === 'Partenaires') {
                    const packs = tracking?.Pack_Choisi || 'Aucun pack';
                    specifics = `Partenariat - Options: ${packs}`;
                } else if (type === 'Stand') {
                    const nbJour = tracking?.nb_jour || '?';
                    specifics = `Stand - ${nbJour} jours`;
                } else {
                    specifics = `Facturation pour ${entity.title}`;
                }

                intelligentDescription = eventHeader + specifics;
            }

            setFormData({
                Facture_Nom: tracking?.Facture_Nom || entity.title || '',
                Facture_Adresse: tracking?.Facture_Adresse || entity.address || '',
                Siret: entity.Siret || '', // Direct mapping to Entity field
                Facture_Email: tracking?.Facture_Email || tracking?.Email_Contact || '',
                Facture_Montant: tracking?.Facture_Montant || entity.Recette || '',
                Facture_Description: intelligentDescription,
                // Try both cases to be safe, preferring the lowercase if user asked for it, or Upper if standard
                // User asked for "date_paiement" originally.
                Date_Paiement: parseDateToIso(tracking?.date_paiement || tracking?.Date_Paiement || ''), 
                Type_Paiement: tracking?.Type_Paiement || tracking?.type_paiement || ''
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
        // Validation required fields
        const required = ['Facture_Nom', 'Facture_Adresse', 'Facture_Email', 'Facture_Description', 'Facture_Montant'];
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
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Nom / Raison Sociale *</label>
                        <input
                            type="text"
                            name="Facture_Nom"
                            value={formData.Facture_Nom}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Adresse Complète *</label>
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
                                name="Siret"
                                value={formData.Siret || ''}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Email Envoi *</label>
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
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Description *</label>
                            <textarea
                                name="Facture_Description"
                                value={formData.Facture_Description}
                                onChange={handleChange}
                                rows={6}
                                style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Montant (€) *</label>
                            <input
                                type="number"
                                name="Facture_Montant"
                                value={formData.Facture_Montant}
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
                     <div>
                        <label style={{ fontWeight: 'bold', display: 'block', fontSize: '0.9rem' }}>Type Paiement</label>
                         <select
                            name="Type_Paiement"
                            value={formData.Type_Paiement || ''}
                            onChange={handleChange}
                            style={{ width: '100%', padding: '10px', border: '2px solid black', fontFamily: 'inherit' }}
                        >
                            <option value="">- Sélectionner -</option>
                            <option value="Virement">Virement</option>
                            <option value="Chèque">Chèque</option>
                            <option value="Espèces">Espèces</option>
                            <option value="Carte Bancaire">Carte Bancaire</option>
                            <option value="Autre">Autre</option>
                        </select>
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
                            ENREGISTRER & GÉNÉRER FACTURE
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
