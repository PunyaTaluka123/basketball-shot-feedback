import React, { useState } from 'react';
import { api } from '../api/api';

export default function UploadForm() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [analysis, setAnalysis] = useState(null);

  const handleChange = e => setFile(e.target.files[0]);

  const handleUpload = async e => {
    e.preventDefault();
    if (!file) return;
    setStatus('Uploading...');
    const formData = new FormData();
    formData.append('video', file);
    try {
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStatus('Analyzing...');
      const analysisRes = await api.post(`/analyze/${res.data.video_id}`);
      setAnalysis(analysisRes.data);
      setStatus('Done!');
    } catch (err) {
      setStatus('Upload or analysis failed');
    }
  };

  return (
    <div>
      <form onSubmit={handleUpload}>
        <input type="file" accept="video/*" onChange={handleChange} />
        <button type="submit">Upload & Analyze</button>
      </form>
      {status && <div>{status}</div>}
      {analysis && (
        <div>
          <h4>Analysis Result</h4>
          <pre>{JSON.stringify(analysis, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
