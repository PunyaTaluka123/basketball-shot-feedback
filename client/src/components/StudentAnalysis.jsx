import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const StudentAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [studentEmail, setStudentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStudentVideos = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all videos for this student (player)
        const response = await axios.get(`http://localhost:3001/api/videos/coach`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        // Filter videos for this player
        const studentVideos = response.data.filter(v => v.playerId === parseInt(id));
        setVideos(studentVideos);
        if (studentVideos.length > 0) {
          setStudentEmail(studentVideos[0].Player?.email || '');
        } else {
          setStudentEmail('');
        }
      } catch (err) {
        setError('Error fetching student videos');
      } finally {
        setLoading(false);
      }
    };
    fetchStudentVideos();
  }, [id]);

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#181818', padding: 0, margin: 0 }}>
      <button onClick={() => navigate(-1)} className="logout-button" style={{ margin: 20 }}>&larr; Back</button>
      <h2 style={{ color: '#fff', marginLeft: 32 }}>Student Analysis</h2>
      {studentEmail && <h3 style={{ color: '#fff', marginLeft: 32 }}>Student: {studentEmail}</h3>}
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <div className="videos-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {videos.length > 0 ? (
            videos.map((video) => (
              <div key={video.id} className="video-item" style={{ background: '#232323', borderRadius: 12, padding: 24, margin: '0 auto', maxWidth: 700, width: '100%', display: 'flex', alignItems: 'center', gap: 24 }}>
                <div className="video-container" style={{ minWidth: 120, maxWidth: 180, flex: '0 0 180px' }}>
                  <video 
                    src={`http://localhost:3001${video.videoUrl}`}
                    style={{ width: '100%', height: 'auto', maxHeight: 100, borderRadius: 8, objectFit: 'cover', background: '#111' }}
                    muted
                    controls={false}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#fff', margin: 0 }}>{video.title}</h4>
                  <p style={{ color: '#bbb', margin: '8px 0' }}>Uploaded on: {new Date(video.uploadDate).toLocaleDateString()}</p>
                  <button
                    className="analyze-button"
                    style={{ padding: '8px 18px', borderRadius: 6, background: '#82b1ff', color: '#232323', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => navigate(`/analysis/${video.id}`)}
                  >
                    View Analysis
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No videos uploaded by this student yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAnalysis; 
