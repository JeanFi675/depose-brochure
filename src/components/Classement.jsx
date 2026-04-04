import React, { useMemo } from 'react';

const Classement = ({ locations }) => {
  const stats = useMemo(() => {
    const byReferent = {};

    locations.forEach(loc => {
      const ref = loc.referent;
      if (!ref) return;
      if (!byReferent[ref]) byReferent[ref] = 0;
      byReferent[ref]++;
    });

    const referentList = Object.entries(byReferent)
      .map(([name, lieux]) => ({ name, lieux }))
      .sort((a, b) => b.lieux - a.lieux);

    const eligibles = referentList.filter(r => r.lieux >= 5);
    const ineligibles = referentList.filter(r => r.lieux < 5);

    const totalDeposes = locations.filter(l => l.BrochureDeposee).length;

    return { referentList, eligibles, ineligibles, totalDeposes };
  }, [locations]);

  const maxLieux = stats.eligibles.length > 0
    ? Math.max(...stats.eligibles.map(r => r.lieux), 1)
    : 1;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Classement</h1>
          <p className="dashboard-subtitle">Suivi des performances &amp; Classement</p>
        </div>
      </div>

      <div className="classement-intro-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📍</div>
          <div className="kpi-label">Points de dépôt</div>
          <div className="kpi-value">{stats.totalDeposes}</div>
        </div>

        <div className="classement-explication">
          <h3 className="classement-explication-titre">Le classement, pour quoi faire&nbsp;?</h3>
          <p>
            Le classement que tu vois là, c'est pas décoratif. Si des lots n'ont pas trouvé preneur
            à la tombola, les bénévoles les mieux classés se servent en premier — un lot chacun,
            dans l'ordre du classement.
          </p>
          <p>
            Autrement dit&nbsp;: plus tu as référencé de points de dépôt, plus tu passes tôt au buffet des lots.
          </p>
          <p className="classement-explication-note">
            <strong>Condition pour en profiter&nbsp;:</strong> avoir référencé au minimum <strong>5 points de dépôt</strong>.
            En dessous, on applaudit les autres.
          </p>
        </div>
      </div>

      <div className="leaderboard-section">
        <h2>Le Classement</h2>

        {stats.eligibles.length === 0 && (
          <div className="dashboard-empty">
            Aucun bénévole n'a encore atteint 5 points de dépôt.
          </div>
        )}

        <div className="leaderboard-list">
          {stats.eligibles.map((ref, i) => {
            const progress = (ref.lieux / maxLieux) * 100;

            return (
              <div key={ref.name} className={`leaderboard-item${i === 0 ? ' lb-first' : ''}`}>
                <div className="lb-rank">#{i + 1}</div>
                <div className="lb-body">
                  <div className="lb-top-row">
                    <span className="lb-name">
                      {ref.name.toUpperCase()}{i === 0 ? ' 👑' : ''}
                    </span>
                    <span className="lb-score">
                      {ref.lieux} point{ref.lieux !== 1 ? 's' : ''} de dépôt
                    </span>
                  </div>
                  <div className="lb-progress-track">
                    <div
                      className="lb-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {stats.ineligibles.length > 0 && (
          <div className="leaderboard-ineligibles">
            <h3>En cours — pas encore éligibles (moins de 5 points de dépôt)</h3>
            <div className="leaderboard-list leaderboard-list--muted">
              {stats.ineligibles.map((ref) => (
                <div key={ref.name} className="leaderboard-item lb-ineligible">
                  <div className="lb-rank lb-rank--muted">—</div>
                  <div className="lb-body">
                    <div className="lb-top-row">
                      <span className="lb-name lb-name--muted">{ref.name.toUpperCase()}</span>
                      <span className="lb-score lb-score--muted">
                        {ref.lieux} / 5 point{ref.lieux !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="lb-progress-track">
                      <div
                        className="lb-progress-fill lb-progress-fill--muted"
                        style={{ width: `${(ref.lieux / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Classement;
