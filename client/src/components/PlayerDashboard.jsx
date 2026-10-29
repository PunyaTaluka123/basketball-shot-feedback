import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import VideoUpload from './VideoUpload';
import './PlayerDashboard.css';
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

const PlayerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [coachEmail, setCoachEmail] = useState(null);
  const [pendingCoach, setPendingCoach] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [videos, setVideos] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const videoRefs = useRef({});
  const [analysisData, setAnalysisData] = useState({});
  const [showFullTable, setShowFullTable] = useState(null); // videoId or null
  
  
  function mergeByDate(a, b) {
  let i = 0, j = 0, result = [];
  while (i < a.length && j < b.length) {
    if (new Date(a[i].uploadDate) < new Date(b[j].uploadDate)) {
      result.push(a[i++]);
    } else {
      result.push(b[j++]);
    }
  }
  return result.concat(a.slice(i), b.slice(j));
}

  useEffect(() => {
    if (!user.email) {
      navigate('/auth');
      return;
    }
  
    const fetchPendingInvitation = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/coach/pending-invitation', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setPendingCoach(data.coach);
        }
      } catch (err) {
        console.error('Error fetching pending invitation:', err);
      }
    };
  
    const fetchCoachDetails = async () => {
      if (!user.coachId) return;

      try {
        const res = await fetch(`http://localhost:3001/api/coach/${user.coachId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setCoachEmail(data.email);
        }
      } catch (err) {
        console.error('Error fetching coach details:', err);
      }
    };

    const fetchVideos = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/videos/player', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log("response.data", response.data);
        if (response.data) {
          setVideos(response.data);
          setErrorMessage('');
        } else {
          setErrorMessage('No videos found');
        }
      } catch (err) {
        console.error('Error fetching videos:', err);
        if (err.response) {
          setErrorMessage(err.response.data.message || 'Error fetching videos');
        } else {
          setErrorMessage('Error connecting to server');
        }
      }
    };
  
    fetchPendingInvitation();
    fetchCoachDetails();
    fetchVideos();
    // Fetch progress data for improvement graph
    axios.get('http://localhost:3001/api/videos/player/progress', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => setProgressData(res.data))
      .catch(err => console.error('Error fetching progress data:', err));

    // Fetch analysis data for all videos
    const fetchAllAnalysis = async () => {
      const data = {};
      for (const video of videos) {
        try {
          const res = await axios.get(`http://localhost:3001/api/video/${video.id}/analysis`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          data[video.id] = res.data;
        } catch (e) {
          data[video.id] = null;
        }
      }
      setAnalysisData(data);
    };
    if (videos.length > 0) fetchAllAnalysis();
  }, [user, navigate]);

  const handleRespondToInvite = async (action) => {
    try {
      const res = await fetch('http://localhost:3001/api/coach/respond-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();

      if (res.ok) {
        if (action === 'accept') {
          const updatedUser = { ...user, coachId: pendingCoach.id, pendingCoachId: null };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
          setCoachEmail(pendingCoach.email);
          setSuccessMessage('You have successfully joined the coach!');
        } else {
          setSuccessMessage('Invitation rejected.');
        }
        setPendingCoach(null);
        setErrorMessage('');
      } else {
        setErrorMessage(data.message || 'Failed to respond to invitation.');
      }
    } catch (err) {
      setErrorMessage('Server error.');
    }
  };

  const handleLeaveCoach = async () => {
    if (!window.confirm('Are you sure you want to leave your current coach?')) return;
    try {
      const res = await fetch('http://localhost:3001/api/auth/leave-coach', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message);
        setErrorMessage('');
        // Update user state
        const updatedUser = { ...user, coachId: null };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setCoachEmail('');
      } else {
        setErrorMessage(data.message);
        setSuccessMessage('');
      }
    } catch (err) {
      setErrorMessage('Server error');
      setSuccessMessage('');
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/auth');
    }
  };

  const handleVideoUploaded = (newVideo) => {
    console.log('New video uploaded:', newVideo);
    if (newVideo && newVideo.id) {
      setVideos(prevVideos => [newVideo, ...prevVideos]);
      setSuccessMessage('Video uploaded successfully!');
      setErrorMessage('');
    } else {
      setErrorMessage('Error: Invalid video data received');
    }
  };

  const renderProgressGraph = () => {
    if (!progressData || progressData.length === 0) return <p>No improvement data yet. Upload and analyze videos to see your progress!</p>;
    const labels = progressData.map(p => p.title || p.uploadDate);
    const avgErrors = progressData.map(p => p.avgCollectiveError);
    return (
      <div className="progress-graph dashboard-section">
        <h3>Improvement Progress (Avg. Collective Error per Video)</h3>
        <Line data={{
          labels,
          datasets: [{ label: 'Avg. Collective Error', data: avgErrors, borderColor: 'orange', fill: false }]
        }} options={{ responsive: true, plugins: { legend: { display: true } } }} />
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Welcome, {user.email}</h2>
        <div className="header-actions">
          <button onClick={() => navigate('/metrics')} className="nav-button">Metrics</button>
          <button onClick={() => navigate('/report/student')} className="nav-button">My Report</button>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Personal Info</h3>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Current Coach:</strong> {coachEmail ? coachEmail : 'No coach assigned'}</p>

        {pendingCoach && (
          <div className="invitation-box">
            <p><strong>Coach {pendingCoach.email}</strong> has invited you to join.</p>
            <button onClick={() => handleRespondToInvite('accept')}>Accept</button>
            <button onClick={() => handleRespondToInvite('reject')}>Reject</button>
          </div>
        )}

        {!coachEmail && !pendingCoach && (
          <p>No coach yet. Wait for an invitation.</p>
        )}

        {coachEmail && (
          <button 
            onClick={handleLeaveCoach} 
            className="leave-coach-button"
            style={{ background: '#cf6679', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', marginTop: '10px' }}
          >
            Leave Coach
          </button>
        )}

        {successMessage && <p className="success-message">{successMessage}</p>}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>

      <div className="dashboard-section videos-section">
        <h3>Training Videos</h3>
        <VideoUpload onVideoUploaded={handleVideoUploaded} />
        
        <div className="videos-list">
          {videos.length > 0 ? (
            videos.map((video) => (
              <div key={video.id} className="video-item">
                <h4>{video.title}</h4>
                {video.description && <p>{video.description}</p>}
                <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                  <div className="video-container" style={{ flex: 1, minWidth: 0 }}>
                    <video
                      ref={el => (videoRefs.current[video.id] = el)}
                      src={`http://localhost:3001${video.videoUrl}`}
                      controls
                      style={{ width: '100%', height: 'auto', maxHeight: '60vh', borderRadius: 12, objectFit: 'cover' }}
                    />
                    <p className="upload-date">Uploaded on: {new Date(video.uploadDate).toLocaleDateString()}</p>
                    <button
                      className="analyze-button"
                      onClick={() => navigate(`/analysis/${video.id}`)}
                      style={{ marginTop: '10px', width: '100%' }}
                    >
                      View Full Analysis
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No videos uploaded yet.</p>
          )}
        </div>
      </div>
      {/* New improvement progress section */}
      {renderProgressGraph()}
    </div>
  );
};

export default PlayerDashboard;
