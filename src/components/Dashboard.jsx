import React, { useMemo } from 'react';

const Dashboard = ({ locations }) => {
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

    const totalDeposes = locations.filter(l => l.BrochureDeposee).length;

    return { referentList, totalDeposes };
  }, [locations]);

  const maxLieux = stats.referentList.length > 0
    ? Math.max(...stats.referentList.map(r => r.lieux), 1)
    : 1;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Suivi des performances &amp; Classement</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">📍</div>
          <div className="kpi-label">Points de dépôt</div>
          <div className="kpi-value">{stats.totalDeposes}</div>
        </div>
      </div>

      <div className="leaderboard-section">
        <h2>Le Classement</h2>

        {stats.referentList.length === 0 && (
          <div className="dashboard-empty">
            Aucun référent assigné pour l'instant.
          </div>
        )}

        <div className="leaderboard-list">
          {stats.referentList.map((ref, i) => {
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
      </div>
    </div>
  );
};

export default Dashboard;
