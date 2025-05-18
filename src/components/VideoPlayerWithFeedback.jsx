import React, { useState } from 'react';
import { api } from '../api/api';

export default function VideoPlayerWithFeedback({ video }) {
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');

  const submitFeedback = async e => {
    e.preventDefault();
    try {
      await api.post(`/feedback/${video.id}`, { comment });
      setMsg('Feedback submitted!');
    } catch {
      setMsg('Failed to submit feedback');
    }
  };

  return (
    <div>
      <video src={video.filepath} controls width="400" />
      <div>
        <h4>Analysis</h4>
        <pre>{JSON.stringify(video.analysis, null, 2)}</pre>
      </div>
      <form onSubmit={submitFeedback}>
        <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Coach Feedback" />
        <button type="submit">Submit Feedback</button>
      </form>
      {msg && <div>{msg}</div>}
    </div>
  );
}
