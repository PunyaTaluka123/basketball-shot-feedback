import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CoachReport = () => {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://localhost:3001/api/videos/coach', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => setVideos(res.data || []))
      .catch(err => setError('Failed to load coach report'));
  }, []);

  const players = Object.values(videos.reduce((acc, v) => {
    const key = v.playerId;
    const email = v.Player?.email || 'unknown';
    if (!acc[key]) acc[key] = { playerId: key, email, count: 0, latest: null };
    acc[key].count += 1;
    const d = new Date(v.uploadDate);
    if (!acc[key].latest || d > acc[key].latest) acc[key].latest = d;
    return acc;
  }, {}));

  return (
    <div className="dashboard-container">
      <h2>Coach Report</h2>
      {error && <p className="error-message">{error}</p>}
      <div className="dashboard-section">
        <h3>Players Overview</h3>
        {players.length === 0 ? (<p>No assigned players/videos.</p>) : (
          <ul>
            {players.map(p => (
              <li key={p.playerId} style={{display:'flex', gap:12, alignItems:'center'}}>
                <span><strong>{p.email}</strong></span>
                <span>Videos: {p.count}</span>
                <span>Latest: {p.latest ? p.latest.toLocaleDateString() : 'N/A'}</span>
                <button onClick={() => navigate(`/student/${p.playerId}/analysis`)}>Open Analysis</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CoachReport;

