import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoAnalysis from './VideoAnalysis';
import axios from 'axios';

const FullAnalysisPage = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const videoRef = useRef(null);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    // Check if current user is a coach
    const user = JSON.parse(localStorage.getItem('user'));
    setIsCoach(user?.role === 'coach');
  }, []);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/video/${videoId}/analysis`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setAnalysis(res.data);
      } catch (e) {
        setAnalysis(null);
      }
    };
    fetchAnalysis();
  }, [videoId]);

  const handleGenerateReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:3001/api/videos/player/report/pdf', {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
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
      console.error('Failed to download report PDF from analysis page', e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#181818', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button onClick={() => navigate(-1)} className="logout-button" style={{ margin: 20, alignSelf: 'flex-start' }}>&larr; Back</button>
      <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 auto' }}>
        <VideoAnalysis videoId={videoId} isCoach={isCoach} forwardedRef={videoRef} />
      </div>
      <button
        style={{ padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: 8, background: '#82b1ff', color: '#232323', border: 'none', cursor: 'pointer', margin: '40px auto 0 auto', display: 'block' }}
        onClick={handleGenerateReport}
      >
        Generate Report
      </button>
    </div>
  );
};

export default FullAnalysisPage; 
