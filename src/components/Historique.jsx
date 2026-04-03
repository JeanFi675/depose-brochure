import React, { useMemo } from 'react';
import { stripGPS } from '../services/api.js';

// Parse "DD/MM/YYYY HH:MM" → Date object for sorting
const parseTimestamp = (ts) => {
  if (!ts) return new Date(0);
  // Format: "03/04/2026 14:30"
  const match = ts.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return new Date(0);
  const [, d, m, y, h, min] = match;
  return new Date(`${y}-${m}-${d}T${h}:${min}:00`);
};

// Parse "[timestamp] text\n[timestamp] text" into array of {timestamp, text}
const parseCommentLines = (rawComments) => {
  const stripped = stripGPS(rawComments);
  if (!stripped) return [];
  return stripped.split('\n').filter(l => l.trim()).map(line => {
    const match = line.match(/^\[(.+?)\] (.+)$/);
    if (match) return { timestamp: match[1], text: match[2] };
    return { timestamp: null, text: line };
  });
};

const Historique = ({ locations }) => {
  const events = useMemo(() => {
    const all = [];
    locations.forEach(loc => {
      const comments = parseCommentLines(loc.Comments);
      comments.forEach(c => {
        all.push({
          timestamp: c.timestamp,
          date: parseTimestamp(c.timestamp),
          text: c.text,
          locationTitle: loc.title,
          locationAddress: loc.address,
          referent: loc.referent,
          locationId: loc.Id,
        });
      });
    });
    // Newest first
    all.sort((a, b) => b.date - a.date);
    return all;
  }, [locations]);

  // Group by date (DD/MM/YYYY)
  const groups = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const day = ev.timestamp ? ev.timestamp.slice(0, 10) : 'Date inconnue';
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    });
    return Object.entries(map);
  }, [events]);

  return (
    <div className="historique-page">
      <div className="dashboard-header">
        <div>
          <h1>Historique</h1>
          <p className="dashboard-subtitle">Journal de toutes les activités</p>
        </div>
        <div className="histo-total">{events.length} entrée{events.length !== 1 ? 's' : ''}</div>
      </div>

      {events.length === 0 && (
        <div className="dashboard-empty">Aucun commentaire enregistré pour l'instant.</div>
      )}

      <div className="histo-timeline">
        {groups.map(([day, evs]) => (
          <div key={day} className="histo-day-group">
            <div className="histo-day-label">{day}</div>
            {evs.map((ev, i) => (
              <div key={i} className="histo-entry">
                <div className="histo-time">
                  {ev.timestamp ? ev.timestamp.slice(11) : '—'}
                </div>
                <div className="histo-content">
                  <div className="histo-text">{ev.text}</div>
                  <div className="histo-meta">
                    <span className="histo-location">{ev.locationTitle}</span>
                    {ev.referent && (
                      <span className="histo-referent">{ev.referent}</span>
                    )}
                    {ev.locationAddress && (
                      <span className="histo-address">{ev.locationAddress}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Historique;
