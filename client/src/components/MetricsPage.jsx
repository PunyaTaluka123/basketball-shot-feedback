import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const MetricsPage = () => {
  const [progressData, setProgressData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get('http://localhost:3001/api/videos/player/progress', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => setProgressData(res.data))
      .catch(err => setError('Failed to load progress data'));
  }, []);

  const renderGraph = () => {
    if (!progressData || progressData.length === 0) return <p>No improvement data yet.</p>;
    const labels = progressData.map(p => p.title || p.uploadDate);
    const avgErrors = progressData.map(p => p.avgCollectiveError);
    return (
      <Line data={{
        labels,
        datasets: [{ label: 'Avg. Collective Error', data: avgErrors, borderColor: 'orange', fill: false }]
      }} options={{ responsive: true, plugins: { legend: { display: true } } }} />
    );
  };

  return (
    <div className="dashboard-container">
      <h2>Tracking Metrics</h2>
      {error && <p className="error-message">{error}</p>}
      <div className="dashboard-section">
        <h3>Improvement Over Time</h3>
        {renderGraph()}
      </div>
    </div>
  );
};

export default MetricsPage;

