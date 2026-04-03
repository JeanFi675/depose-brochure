import React, { useMemo } from 'react';

const Dashboard = ({ locations }) => {
  const stats = useMemo(() => {
    const byReferent = {};

    locations.forEach(loc => {
      const ref = loc.referent;
      if (!ref) return;
      if (!byReferent[ref]) {
        byReferent[ref] = { lieux: 0, deposes: 0 };
      }
      byReferent[ref].lieux++;
      if (loc.BrochureDeposee) {
        byReferent[ref].deposes++;
      }
    });

    const referentList = Object.entries(byReferent)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.deposes - a.deposes || b.lieux - a.lieux);

    const totalDeposes = locations.filter(l => l.BrochureDeposee).length;

    return { referentList, totalDeposes };
  }, [locations]);

  const maxDeposes = stats.referentList.length > 0
    ? Math.max(...stats.referentList.map(r => r.deposes), 1)
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
          <div className="kpi-icon">✅</div>
          <div className="kpi-label">Total Brochures Déposées</div>
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
            const progress = maxDeposes > 0 ? (ref.deposes / maxDeposes) * 100 : 0;
            const nonDeposes = ref.lieux - ref.deposes;
            const refusPct = ref.lieux > 0
              ? Math.round((nonDeposes / ref.lieux) * 100)
              : 0;

            return (
              <div key={ref.name} className={`leaderboard-item${i === 0 ? ' lb-first' : ''}`}>
                <div className="lb-rank">#{i + 1}</div>
                <div className="lb-body">
                  <div className="lb-top-row">
                    <span className="lb-name">
                      {ref.name.toUpperCase()}{i === 0 ? ' 👑' : ''}
                    </span>
                    <span className="lb-score">
                      {ref.deposes} déposé{ref.deposes !== 1 ? 's' : ''}
                      <span className="lb-score-max"> / {ref.lieux} lieux</span>
                    </span>
                  </div>
                  <div className="lb-progress-track">
                    <div
                      className="lb-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="lb-stats-row">
                    <span className="lb-stat lb-stat-signed">
                      🤝 {ref.deposes} Déposé{ref.deposes !== 1 ? 's' : ''}
                    </span>
                    {ref.partenaires > 0 && (
                      <span className="lb-stat lb-stat-refused">
                        ❌ {nonDeposes} Non déposé{nonDeposes !== 1 ? 's' : ''} ({refusPct}%)
                      </span>
                    )}
                    <span className="lb-stat lb-stat-lieux">
                      📍 {ref.lieux} Lieu{ref.lieux !== 1 ? 'x' : ''}
                    </span>
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
