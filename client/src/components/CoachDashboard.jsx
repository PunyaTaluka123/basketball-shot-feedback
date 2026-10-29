import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CoachDashboard.css';

const CoachDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); // Initialize user state
  const [players, setPlayers] = useState([]);
  const [playerEmail, setPlayerEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [playerSearch, setPlayerSearch] = useState(""); // Search bar state
  const [sortOrder, setSortOrder] = useState("desc"); // 'asc' or 'desc' for sorting by upload date
  const [ageFilter, setAgeFilter] = useState('all'); // Add this state

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
      setUser(storedUser);
    } else {
      setErrorMessage('No user data found.');
      setLoading(false);
      return;
    }
  
    const fetchPlayers = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/coach/players', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await res.json();
        if (res.ok) {
          setPlayers(data);
        } else {
          setErrorMessage(data.message || 'Failed to fetch players.');
        }
      } catch (err) {
        setErrorMessage('Server error.');
      } finally {
        setLoading(false);
      }
    };

    const fetchVideos = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/videos/coach', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setVideos(response.data);
      } catch (err) {
        setErrorMessage('Error fetching videos');
        console.error(err);
      }
    };
  
    fetchPlayers();
    fetchVideos();
  }, []); // <<< THIS EMPTY ARRAY IS IMPORTANT
  
  const handleAssignPlayer = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/coach/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ playerEmail })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Refresh the players list after successful assignment
        const refreshedRes = await fetch('http://localhost:3001/api/coach/players', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const refreshedData = await refreshedRes.json();
        setPlayers(refreshedData);
        setSuccessMessage("Player invited successfully");
        setPlayerEmail('');
      } else {
        setErrorMessage(data.message || 'Failed to assign player.');
        setSuccessMessage('');
      }
    } catch (err) {
      setErrorMessage('Server error.');
      setSuccessMessage('');
    }
  };

  // Delete player
  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm('Are you sure you want to remove this student?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/auth/players/${playerId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setPlayers(players.filter((p) => p.id !== playerId));
        setSuccessMessage(data.message || 'Student removed successfully.');
        setErrorMessage('');
      } else {
        setErrorMessage(data.message || 'Failed to remove student.');
        setSuccessMessage('');
      }
    } catch (err) {
      setErrorMessage('Server error.');
      setSuccessMessage('');
    }
  };

  // Redirect to student analysis
  const handleStudentClick = (playerId) => {
    navigate(`/student/${playerId}/analysis`);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/auth');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>No user data found, please log in.</div>;
  }

  return (
    <div className="dashboard-container coach-dashboard">
      <div className="dashboard-header">
        <h2>Welcome, Coach {user.email}</h2>
        <div className="header-actions">
          <button onClick={() => navigate('/report/coach')} className="nav-button">Coach Report</button>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Assigned Players</h3>
        {/* Search bar for filtering players by email */}
        <input
          type="text"
          placeholder="Search players by email..."
          value={playerSearch}
          onChange={e => setPlayerSearch(e.target.value)}
          style={{ marginBottom: '12px', padding: '6px', width: '100%' }}
        />
        {/* Sort order dropdown */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="sortOrder" style={{ marginRight: '8px' }}>Sort by latest upload date:</label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            style={{ padding: '4px' }}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
        {/* Filter by age group */}
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="ageFilter" style={{ marginRight: '8px' }}>Filter by Age Group:</label>
          <select
            id="ageFilter"
            value={ageFilter}
            onChange={e => setAgeFilter(e.target.value)}
            style={{ padding: '4px', marginRight: '16px' }}
          >
            <option value="all">All</option>
            <option value="u14">U-14</option>
            <option value="u18">U-18</option>
            <option value="u19">U-19</option>
          </select>
        </div>
        <ul>
          {players.length > 0 ? (
            players
              .filter(player =>
                player && player.email && player.email.toLowerCase().includes(playerSearch.toLowerCase())
              )
              // Filter by age group
              .filter(player => {
                if (ageFilter === 'all') return true;
                if (ageFilter === 'u14') return player.age && player.age < 14;
                if (ageFilter === 'u18') return player.age && player.age >= 14 && player.age < 18;
                if (ageFilter === 'u19') return player.age && player.age >= 14 && player.age < 19;
                return true;
              })
              .map(player => {
                const playerVideos = videos.filter(v => v.Player && v.playerId === player.id);
                let latestVideoDate = null;
                
                if (playerVideos.length > 0) {
                  console.log(playerVideos);
                  latestVideoDate = playerVideos
                    .map(v => new Date(v.uploadDate))
                    .sort((a, b) => b - a)[0];
                }
                return {
                  ...player,
                  latestVideoDate,
                  videoCount: playerVideos.length
                };
              })
              .sort((a, b) => {
                if (!a.latestVideoDate && !b.latestVideoDate) return 0;
                if (!a.latestVideoDate) return sortOrder === 'asc' ? 1 : -1;
                if (!b.latestVideoDate) return sortOrder === 'asc' ? -1 : 1;
                return sortOrder === 'asc'
                  ? a.latestVideoDate - b.latestVideoDate
                  : b.latestVideoDate - a.latestVideoDate;
              })
              .map((player, index) => (
                player && player.email ? (
                  <li key={index} className="student-list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <span
                        className="student-email-link"
                        onClick={() => handleStudentClick(player.id)}
                        style={{ cursor: 'pointer', color: '#82b1ff', textDecoration: 'underline', marginRight: '16px' }}
                      >
                        {player.email}
                      </span>
                      <span style={{ color: '#888' }}>
                        {player.latestVideoDate
                          ? `Latest upload: ${player.latestVideoDate.toLocaleDateString()} ${player.latestVideoDate.toLocaleTimeString()}`
                          : 'No uploads yet'}
                      </span>
                      <span style={{ color: '#888' }}>{`Videos uploaded: ${player.videoCount}`}</span>
                      <span style={{ color: '#888' }}>{player.age ? `Age: ${player.age}` : 'Age: N/A'}</span>
                    </div>
                    <button
                      className="delete-student-btn"
                      onClick={() => handleDeletePlayer(player.id)}
                      style={{ background: '#cf6679', color: 'white', border: 'none', borderRadius: '4px', width: '80px', padding: '4px 0', cursor: 'pointer', minWidth: 'unset' }}
                    >
                      Delete
                    </button>
                  </li>
                ) : (
                  <li key={index}>Invalid player data</li>
                )
              ))
          ) : (
            <p>No players assigned yet.</p>
          )}
        </ul>
      </div>

      <div className="dashboard-section">
        <h3>Assign a Player</h3>
        <input
          type="email"
          placeholder="Enter Player's Email"
          value={playerEmail}
          onChange={(e) => setPlayerEmail(e.target.value)}
        />
        <button onClick={handleAssignPlayer}>Assign Player</button>

        {successMessage && <p className="success-message">{successMessage}</p>}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </div>

      {/* <div className="dashboard-section">
        <h3>Player Training Videos</h3>
        <div className="videos-list">
          {videos.length > 0 ? (
            videos.map((video) => (
              <div key={video.id} className="video-item">
                <h4>{video.title}</h4>
                <p className="player-info">Uploaded by: {video.Player?.email}</p>
                {video.description && <p>{video.description}</p>}
                <div className="video-container">
                  <video 
                    src={`http://localhost:3001${video.videoUrl}`}
                    controls
                    className="video-player"
                  />
                </div>
                <VideoAnalysis videoId={video.id} isCoach={true} />
                <p className="upload-date">Uploaded on: {new Date(video.uploadDate).toLocaleDateString()}</p>
              </div>
            ))
          ) : (
            <p>No videos uploaded by players yet.</p>
          )}
        </div>
      </div> */}
    </div>
  );
};

export default CoachDashboard;
