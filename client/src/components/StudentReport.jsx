import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const StudentReport = () => {
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [videoResponse, progressResponse] = await Promise.all([
          axios.get('http://localhost:3001/api/videos/player', config),
          axios.get('http://localhost:3001/api/videos/player/progress', config)
        ]);
        setVideos(videoResponse.data || []);
        setProgress(progressResponse.data || []);
        setError('');
      } catch (e) {
        setError('Failed to load report data');
      }
    };
    load();
  }, []);

  const downloadPDF = async () => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/videos/player/report/pdf', {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Failed to download report');
    }
  };

  const sortedProgress = useMemo(() => {
    return [...progress].sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));
  }, [progress]);

  const latestEntry = sortedProgress[sortedProgress.length - 1];
  const latestAverage = typeof latestEntry?.avgCollectiveError === 'number'
    ? latestEntry.avgCollectiveError
    : null;

  const improvement = sortedProgress.length > 1
    ? (() => {
        const firstValue = sortedProgress[0]?.avgCollectiveError;
        const lastValue = sortedProgress[sortedProgress.length - 1]?.avgCollectiveError;
        if (typeof firstValue !== 'number' || typeof lastValue !== 'number') {
          return null;
        }
        return firstValue - lastValue;
      })()
    : null;

  return (
    <div className="dashboard-container">
      <h2>Student Report</h2>
      {error && <p className="error-message">{error}</p>}
      <div className="dashboard-section">
        <h3>Summary</h3>
        <p>Total Videos: {videos.length}</p>
        {latestAverage !== null && (
          <p>Latest Average Form Error: {latestAverage.toFixed(2)}</p>
        )}
        {improvement !== null && (
          <p>All-time Form Improvement: {improvement >= 0 ? '+' : ''}{improvement.toFixed(2)} form error</p>
        )}
        <button onClick={downloadPDF}>Download PDF</button>
      </div>
      <div className="dashboard-section">
        <h3>Videos</h3>
        <ul>
          {videos.map((video) => (
            <li key={video.id}>{video.title} - {new Date(video.uploadDate).toLocaleDateString()}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StudentReport;
