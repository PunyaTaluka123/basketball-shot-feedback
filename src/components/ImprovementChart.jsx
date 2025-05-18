import React, { useEffect, useState, useContext } from 'react';
import { Line } from 'react-chartjs-2';
import { api } from '../api/api';
import { AuthContext } from '../AuthContext';

export default function ImprovementChart() {
  const { user } = useContext(AuthContext);
  const [scores, setScores] = useState([]);

  useEffect(() => {
    if (user) {
      api.get(`/videos/${user.id || ''}`).then(res => {
        setScores(res.data.map(v => v.analysis?.score).filter(Boolean));
      });
    }
  }, [user]);

  const data = {
    labels: scores.map((_, i) => `Shot ${i + 1}`),
    datasets: [{ label: 'Score', data: scores, borderColor: 'blue' }],
  };

  return (
    <div>
      <h3>Improvement Chart</h3>
      <Line data={data} />
    </div>
  );
}
