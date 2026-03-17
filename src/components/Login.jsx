import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_APP_PASSWORD;
    if (password === correctPassword) {
      onLogin();
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
      minHeight: '100dvh',
      backgroundColor: 'var(--brutal-bg)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        border: 'var(--brutal-border)',
        boxShadow: 'var(--brutal-shadow)',
        padding: '32px',
        backgroundColor: 'var(--brutal-white)'
      }}>
        <h1 style={{
          fontSize: '1.6rem',
          marginBottom: '8px',
          textAlign: 'center',
          borderBottom: '3px solid #000',
          paddingBottom: '14px'
        }}>
          Dépôt Brochures
        </h1>

        <p style={{
          textAlign: 'center',
          color: '#666',
          marginBottom: '28px',
          fontSize: '0.9rem',
          marginTop: '12px'
        }}>
          Recensement des points de dépôt
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontWeight: 'bold',
              marginBottom: '6px',
              fontSize: '0.85rem',
              textTransform: 'uppercase'
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Entrez le mot de passe"
              autoFocus
            />
          </div>

          {error && (
            <div style={{
              padding: '10px',
              backgroundColor: '#ffebee',
              border: '2px solid #c62828',
              color: '#c62828',
              marginBottom: '16px',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--brutal-ice)',
              fontSize: '1rem'
            }}
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
