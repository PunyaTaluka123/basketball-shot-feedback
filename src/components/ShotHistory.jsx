import React, { useEffect, useState, useContext } from 'react';
import { api } from '../api/api';
import { AuthContext } from '../AuthContext';

export default function ShotHistory() {
  const { user } = useContext(AuthContext);
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (user) {
      api.get(`/videos/${user.id || ''}`)
        .then(res => setVideos(res.data))
        .catch(() => setVideos([]));
    }
  }, [user]);

  return (
    <div>
      <h3>Shot History</h3>
      <ul>
        {videos.map(v => (
          <li key={v.id} onClick={() => setSelected(v)} style={{cursor:'pointer'}}>
            Video {v.id} - {v.timestamp}
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h4>Video Details</h4>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
