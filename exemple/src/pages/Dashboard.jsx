import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = ({ entities }) => {

    // Constant Goal
    const GOAL_REVENUE = 21000;

    // --- Calculation Logic ---
    const stats = useMemo(() => {
        const totalEntities = entities.length;
        const validFinancialStatuses = ['Confirmé (en attente de paiement)', 'Paiement effectué'];

        // Helper to check if entity counts for revenue
        const isValidForRevenue = (e) => {
            if (!e.Type) return false;
            // Exclude Tombola from all revenue counts (Global & Per Person)
            if (e.Type.includes('Tombola')) return false;

            if (e.Type === 'Encart Pub') {
                return validFinancialStatuses.includes(e.Statuts);
            }
            return true; // Other types count if they have revenue > 0
        };

        const totalRevenue = entities.reduce((sum, e) => {
            if (!isValidForRevenue(e)) return sum;
            return sum + (parseFloat(e.Recette) || 0);
        }, 0);

        const signedDeals = entities.filter(e =>
            validFinancialStatuses.includes(e.Statuts)
        ).length;

        const conversionRate = totalEntities > 0 ? ((signedDeals / totalEntities) * 100).toFixed(1) : 0;

        const referentMap = {};
        entities.forEach(e => {
            const ref = e.Référent_partenariat_club || 'Non attribué';
            if (ref === 'Non attribué') return;
            if (!referentMap[ref]) {
                referentMap[ref] = { name: ref, revenue: 0, signedCount: 0, refusedCount: 0, totalCount: 0 };
            }

            // Revenue Calculation with Check
            if (isValidForRevenue(e)) {
                const revenue = parseFloat(e.Recette) || 0;
                referentMap[ref].revenue += revenue;
            }

            referentMap[ref].totalCount += 1;

            if (validFinancialStatuses.includes(e.Statuts)) {
                referentMap[ref].signedCount += 1;
            } else if (e.Statuts === 'Refusé') {
                referentMap[ref].refusedCount += 1;
            }
        });

        const leaderboard = Object.values(referentMap).sort((a, b) => b.revenue - a.revenue);

        // Global Goal Progress
        const goalProgressPct = ((totalRevenue / GOAL_REVENUE) * 100).toFixed(1);

        return { totalEntities, totalRevenue, signedDeals, conversionRate, leaderboard, goalProgressPct };
    }, [entities]);

    const formatCurrency = (val) => {
        return val.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    };

    return (
        <div className="d-container">
            {/* Header */}
            <div className="d-header">
                <div>
                    <h1 className="d-title">
                        Dashboard<br />Commander
                    </h1>
                    <p className="d-subtitle">
                        Suivi des performances & Classement
                    </p>
                </div>

                <Link to="/" className="d-back-btn">
                    📍 Retour Carte
                </Link>
            </div>

            {/* Global Stats Grid */}
            <div className="d-grid">
                <StatCard
                    title="Chiffre d'Affaires"
                    value={formatCurrency(stats.totalRevenue)}
                    sub={`Objectif: ${stats.goalProgressPct}%`}
                    icon="💶"
                />
                <StatCard
                    title="Contrats Signés"
                    value={stats.signedDeals}
                    sub={`Taux de réussite: ${stats.conversionRate}%`}
                    icon="✍️"
                />
                <StatCard
                    title="Total Prospects"
                    value={stats.totalEntities}
                    icon="🎯"
                />
            </div>

            {/* Leaderboard Section */}
            <div>
                <h2 className="d-section-title">
                    🏆 Le Classement (Objectif {formatCurrency(GOAL_REVENUE)})
                </h2>

                <div className="d-leaderboard">
                    {stats.leaderboard.map((ref, index) => (
                        <LeaderboardRow
                            key={ref.name}
                            refData={ref}
                            index={index}
                            formatCurrency={formatCurrency}
                            goal={GOAL_REVENUE}
                        />
                    ))}
                    {stats.leaderboard.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', fontStyle: 'italic' }}>
                            <p>💤 Aucune donnée pour le moment.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Components
const StatCard = ({ title, value, sub, icon }) => {
    return (
        <div className="d-stat-card">
            <div className="d-stat-icon">{icon}</div>
            <div>
                <h3 className="d-stat-title">{title}</h3>
                <span className="d-stat-value">{value}</span>
            </div>
            {sub && <div className="d-stat-sub">{sub}</div>}
        </div>
    );
};

const LeaderboardRow = ({ refData, index, formatCurrency, goal }) => {
    const isFirst = index === 0;

    // Calculate percentages
    const totalLocations = refData.totalCount || 1;
    const progressPct = Math.min(100, (refData.revenue / goal) * 100);
    const refusedPct = (refData.refusedCount / totalLocations) * 100;

    return (
        <div className={`d-row ${isFirst ? 'gold' : ''}`}>
            {/* Rank Box */}
            <div className="d-rank">
                #{index + 1}
            </div>

            {/* Content */}
            <div className="d-info">
                <div className="d-row-header">
                    <h3 className="d-name">
                        {refData.name}
                        {isFirst && <span style={{ marginLeft: '10px' }}>👑</span>}
                    </h3>
                    <span className="d-revenue">
                        {formatCurrency(refData.revenue)}
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, marginLeft: '5px' }}>
                            / {formatCurrency(goal)}
                        </span>
                    </span>
                </div>

                {/* Progress Bar (Revenue vs Goal) */}
                <div className="d-progress-bg" style={{ position: 'relative' }}>
                    <div className="d-progress-bar" style={{
                        width: `${progressPct}%`,
                        backgroundColor: isFirst ? 'var(--brutal-black)' : 'var(--brutal-black)'
                    }}></div>
                </div>

                {/* Details Footer */}
                <div className="d-details">
                    <span>
                        ✍️ {refData.signedCount} Signés
                    </span>

                    {/* Refused Indicator */}
                    <span style={{
                        color: 'red',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        border: '1px solid red',
                        padding: '0 5px',
                        backgroundColor: 'rgba(255,0,0,0.05)'
                    }}>
                        ⛔ {refData.refusedCount} Refusés ({Math.round(refusedPct)}%)
                    </span>

                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        🏢 {refData.totalCount} Lieux
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
