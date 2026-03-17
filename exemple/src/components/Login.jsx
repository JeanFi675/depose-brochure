import React, { useState } from 'react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const correctPassword = import.meta.env.VITE_APP_PASSWORD;
        const adminPassword = import.meta.env.VITE_APP_ADMIN_PASSWORD;

        if (password === adminPassword) {
            onLogin('ADMIN');
            setError('');
        } else if (password === correctPassword) {
            onLogin('USER');
            setError('');
        } else {
            setError('Mot de passe incorrect');
            setPassword('');
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: 'var(--brutal-white)',
            padding: '20px'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                border: 'var(--brutal-border)',
                boxShadow: 'var(--brutal-shadow)',
                padding: '40px',
                backgroundColor: '#fff'
            }}>
                <h1 style={{
                    fontSize: '2rem',
                    marginBottom: '10px',
                    textAlign: 'center',
                    borderBottom: '3px solid #000',
                    paddingBottom: '15px'
                }}>
                    🔒 Accès Protégé
                </h1>

                <p style={{
                    textAlign: 'center',
                    color: '#666',
                    marginBottom: '30px',
                    fontSize: '0.9rem'
                }}>
                    Veuillez entrer le mot de passe pour accéder à l'application
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            fontWeight: 'bold',
                            marginBottom: '8px'
                        }}>
                            Mot de passe
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Entrez le mot de passe"
                            style={{
                                width: '100%',
                                padding: '12px',
                                border: '2px solid #000',
                                fontSize: '1rem',
                                fontFamily: 'inherit'
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px',
                            backgroundColor: '#ffebee',
                            border: '2px solid #c62828',
                            color: '#c62828',
                            marginBottom: '20px',
                            fontWeight: 'bold'
                        }}>
                            ❌ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'var(--brutal-ice)',
                            border: 'var(--brutal-border)',
                            boxShadow: 'var(--brutal-shadow)',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'transform 0.1s'
                        }}
                        onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
                    >
                        Se connecter
                    </button>
                </form>

                <p style={{
                    marginTop: '30px',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    color: '#999'
                }}>
                    Championnat de France d'escalade de difficultés jeunes 2026
                </p>
            </div>
        </div>
    );
};

export default Login;
