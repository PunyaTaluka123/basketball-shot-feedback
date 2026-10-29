import React, { useState } from 'react';
import './VideoUpload.css';

const VideoUpload = ({ onVideoUploaded }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    console.log('Selected file:', file);
    
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setError('');
    } else {
      setError('Please select a valid video file');
      setVideoFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || !title) {
      setError('Please provide both a title and a video file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      // First, upload the video file to get a URL
      const formData = new FormData();
      formData.append('video', videoFile);
      console.log('Uploading file:', videoFile.name);
      const uploadRes = await fetch('http://localhost:3001/api/videos/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        console.error('Upload response error:', errorData);
        throw new Error(errorData.message || 'Failed to upload video file');
      }

      const uploadData = await uploadRes.json();
      console.log('Upload response:', uploadData);
      setUploadProgress(50);

      // Then, save the video information and start analysis
      const saveRes = await fetch('http://localhost:3001/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title,
          description,
          videoUrl: uploadData.videoUrl,
          filePath: uploadData.filePath
        })
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        console.error('Save response error:', errorData);
        throw new Error(errorData.message || 'Failed to save video information');
      }

      const savedVideo = await saveRes.json();
      console.log('Save response:', savedVideo);
      setUploadProgress(100);
      setSuccess('Video uploaded successfully!');
      setTitle('');
      setDescription('');
      setVideoFile(null);
      if (onVideoUploaded) {
        onVideoUploaded(savedVideo);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload-container">
      <h3>Upload Training Video</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter video title"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter video description"
          />
        </div>

        <div className="form-group">
          <label htmlFor="video">Video File:</label>
          <input
            type="file"
            id="video"
            accept="video/*"
            onChange={handleFileChange}
            required
          />
          {videoFile && (
            <div className="file-info">
              Selected file: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
            </div>
          )}
        </div>

        {uploading && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
      </form>
    </div>
  );
};

export default VideoUpload; 
