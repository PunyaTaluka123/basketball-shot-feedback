import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './VideoAnalysis.css';

const VideoAnalysis = ({ videoId, isCoach, forwardedRef }) => {
  const [video, setVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [newFeedback, setNewFeedback] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const localVideoRef = useRef(null);
  const videoRef = forwardedRef ? forwardedRef : localVideoRef;
  const [savedFeedback, setSavedFeedback] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(''); 
  const [success, setSuccess] = useState('');
  const [errorData, setErrorData] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleAnalyzeVideo = useCallback(async () => {
    setIsAnalyzing(true);
    setError('');
    try {
      await axios.post(`http://localhost:3001/api/video/${videoId}/analysis`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      setSuccess('Video analysis started!');
      
      // Poll for analysis results
      const pollInterval = setInterval(async () => {
        try {
          const videoRes = await axios.get(`http://localhost:3001/api/videos/${videoId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (videoRes.data.analysisStatus === 'completed') {
            clearInterval(pollInterval);
            const analysisRes = await axios.get(`http://localhost:3001/api/video/${videoId}/analysis`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
              }
            });
            setAnalysis(analysisRes.data);
            setVideo(videoRes.data);
            setSuccess('Analysis completed!');
            setTimeout(() => setSuccess(''), 3000);
          } else if (videoRes.data.analysisStatus === 'failed') {
            clearInterval(pollInterval);
            setError('Analysis failed. Please try again.');
            setVideo(videoRes.data);
          }
        } catch (err) {
          console.error('Error polling for analysis:', err);
          clearInterval(pollInterval);
          setError('Error checking analysis status');
        }
      }, 2000); // Poll every 2 seconds

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (video?.analysisStatus === 'processing') {
          setError('Analysis is taking longer than expected. Please check back later.');
        }
      }, 300000);

    } catch (err) {
      setError('Error starting video analysis');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoId, video?.analysisStatus]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch video details
        console.log('Fetching video details for ID:', videoId);
        const videoRes = await axios.get(`http://localhost:3001/api/videos/${videoId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Video details response:', videoRes.data);
        setVideo(videoRes.data);

        // If video is pending analysis, trigger it
        // if (videoRes.data.analysisStatus === 'pending') {
        //   console.log('Video needs analysis, triggering...');
        //   await handleAnalyzeVideo();
        // } else 
        if (videoRes.data.analysisStatus === 'completed') {
          // Only fetch analysis if it's completed
          console.log('Fetching analysis for video:', videoId);
          const analysisRes = await axios.get(`http://localhost:3001/api/video/${videoId}/analysis`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          });
          console.log('Analysis response:', analysisRes.data);
          setAnalysis(analysisRes.data);
        }

        // Fetch feedback
        console.log('Fetching feedback for video:', videoId);
        const feedbackRes = await axios.get(`http://localhost:3001/api/video/${videoId}/feedback`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        console.log('Feedback response:', feedbackRes.data);
        setFeedback(feedbackRes.data);

        // Fetch error data for graphs
        axios.get(`http://localhost:3001/api/video/${videoId}/errors`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
          .then(res => setErrorData(res.data))
          .catch(err => console.error('Error fetching error data:', err));

        // Fetch progress data for improvement graph
        axios.get(`http://localhost:3001/api/videos/player/progress`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
          .then(res => setProgressData(res.data))
          .catch(err => console.error('Error fetching progress data:', err));

      } catch (error) {
        console.error('Error fetching data:', error);
        if (error.response) {
          console.error('Error response:', error.response.data);
          console.error('Error status:', error.response.status);
        }
        setError('Error loading video data. Please try again.');
      }
    };

    if (videoId) {
      fetchData();
    }
  }, [videoId, handleAnalyzeVideo]);

  useEffect(() => {
    if (video && video.feedback) {
      setSavedFeedback(video.feedback);
    }
  }, [video]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`http://localhost:3001/api/video/${videoId}/feedback`, {
        content: newFeedback,
        timestamp: currentTime
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        } 
      });
      setFeedback([response.data, ...feedback]);
      setNewFeedback('');
      setSuccess('Feedback saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error saving feedback');
      console.error(err);
    }
  };
  const renderAnalysisSummary = () => {
    if (!analysis || !analysis.frames) return null;

    // Calculate averages
    const avgElbow = analysis.frames.reduce((sum, frame) => sum + frame.angles.elbow, 0) / analysis.frames.length;
    const avgShoulder = analysis.frames.reduce((sum, frame) => sum + frame.angles.shoulder, 0) / analysis.frames.length;
    const avgWrist = analysis.frames.reduce((sum, frame) => sum + frame.angles.wrist, 0) / analysis.frames.length;

    // Get most common suggestions
    function collectSuggestions(frames, idx = 0, acc = []) {
  if (idx >= frames.length) return acc;
  return collectSuggestions(frames, idx+1, acc.concat(frames[idx].suggestions || []));
}
    const allSuggestions = collectSuggestions(analysis.frames);
    const suggestionCounts = allSuggestions.reduce((acc, suggestion) => {
      acc[suggestion] = (acc[suggestion] || 0) + 1;
      return acc;
    }, {});
    const commonSuggestions = Object.entries(suggestionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([suggestion]) => suggestion);

    // --- Release Angles Section ---
    let releaseAnglesSection = null;
    if (analysis.release_angles) {
      releaseAnglesSection = (
        <div className="release-angles" style={{marginTop: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: 8, color: '#111'}}>
          <h3 style={{marginBottom: '0.5rem', color: '#111'}}><u>Release Angles</u></h3>
          <div><strong>Frame:</strong> {analysis.release_angles.frame_number} ({analysis.release_angles.timestamp?.toFixed(2)}s)</div>
          <div><strong>Elbow:</strong> {Math.round(analysis.release_angles.elbow)}°</div>
          <div><strong>Shoulder:</strong> {Math.round(analysis.release_angles.shoulder)}°</div>
          <div><strong>Wrist:</strong> {Math.round(analysis.release_angles.wrist)}°</div>
        </div>
      );
    }
    // --- End Release Angles Section ---

    return (
      <div className="analysis-summary">
        <h4>Analysis Summary</h4>
        <div className="summary-stats">
          <div className="stat">
            <strong>Average Elbow Angle:</strong> {Math.round(avgElbow)}°
          </div>
          <div className="stat">
            <strong>Average Shoulder Angle:</strong> {Math.round(avgShoulder)}°
          </div>
          <div className="stat">
            <strong>Average Wrist Angle:</strong> {Math.round(avgWrist)}°
          </div>
        </div>
        {releaseAnglesSection}
        <div className="common-suggestions">
          <h5>Most Common Suggestions:</h5>
          <ul>
            {commonSuggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };


  return (
    <div className={`video-analysis-container${isFullScreen ? ' fullscreen' : ''}`} style={isFullScreen ? {position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'#000', zIndex:10000, padding:0, margin:0, borderRadius:0} : {}}>
      <div className="analysis-content">
        <h3>Video Analysis</h3>
        
        {video && video.analysisStatus === 'completed' && analysis && (
          <div className="analysis-results">
            <h4>Analysis Results:</h4>
            <div className="video-flex-row">
              {/* Fixed-size video frame */}
              <div className="video-frame-container">
                <div className="video-metrics-bar">
                  {(() => {
                    if (!analysis || !analysis.frames) return null;
                    let currentFrame = analysis.frames.find(
                      frame => Math.abs(frame.timestamp - currentTime) < 1/analysis.fps
                    );
                    if (!currentFrame) {
                      const framesBefore = analysis.frames.filter(frame => frame.timestamp <= currentTime);
                      if (framesBefore.length > 0) {
                        currentFrame = framesBefore[framesBefore.length - 1];
                      } else {
                        currentFrame = analysis.frames[0];
                      }
                    }
                    if (!currentFrame) return null;
                    return (
                      <>
                        <span style={{marginRight: 32}}><strong>Shoulder:</strong> {Math.round(currentFrame.angles.shoulder)}°</span>
                        <span style={{marginRight: 32}}><strong>Elbow:</strong> {Math.round(currentFrame.angles.elbow)}°</span>
                        <span><strong>Wrist:</strong> {Math.round(currentFrame.angles.wrist)}°</span>
                      </>
                    );
                  })()}
                </div>
                <video 
                  ref={videoRef}
                  src={`http://localhost:3001${video.videoUrl}`}
                  controls
                  controlsList="nofullscreen"
                  onTimeUpdate={handleTimeUpdate}
                  className="main-video"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 12 }}
                />
              </div>
              {/* Remove the analysis-sidebar and angles-sidebar-content */}
            </div>
            {renderAnalysisSummary()}
            {analysis && analysis.jump && (
              <div className="jump-summary" style={{marginTop: '1rem', padding: '0.75rem 1rem', background: '#fff3e0', borderRadius: 8, color: '#111'}}>
                <strong>Estimated Jump:</strong> {String(analysis.jump.type || 'unknown').replace('_',' ')}
                {typeof analysis.jump.max_vertical_displacement_px === 'number' && (
                  <span style={{marginLeft: 12}}>
                    ({analysis.jump.max_vertical_displacement_px}px vertical displacement)
                  </span>
                )}
              </div>
            )}
            <div className="analysis-stats">
              <div className="stat">
                <strong>FPS:</strong> {analysis.fps}
              </div>
              <div className="stat">
                <strong>Total Frames:</strong> {analysis.frame_count}
              </div>
              <div className="stat">
                <strong>Analyzed Frames:</strong> {analysis.frames.length}
              </div>
            </div>
          </div>
        )}

        {video && video.analysisStatus === 'processing' && (
          <div className="processing-message">
            Analysis in progress...
          </div>
        )}

        {video && video.analysisStatus === 'failed' && (
          <div className="error-message">
            Analysis failed. Please try again.
            <button 
              className="analyze-button"
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Retry Analysis'}
            </button>
          </div>
        )}

        {/* Coach Feedback Section for both players and coaches */}
        <div className="feedback-section">
          <h4>Coach Feedback</h4>
          {feedback && feedback.length > 0 ? (
            <div className="feedback-list">
              <h5>Previous Feedback:</h5>
              {feedback.map((item, idx) => (
                <div key={item.id || idx} className="saved-feedback">
                  <p>{item.content}</p>
                  {item.timestamp !== undefined && (
                    <span style={{ fontSize: '0.85em', color: '#888' }}>
                      {item.timestamp ? `At ${item.timestamp.toFixed(1)}s` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No feedback from coach yet.</p>
          )}
          {isCoach && (
            <form onSubmit={handleSubmitFeedback} className="feedback-form">
              <textarea
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                placeholder="Enter your feedback for the player..."
                rows="4"
                className="feedback-input"
              />
              <button type="submit" className="submit-feedback">
                Submit Feedback
              </button>
            </form>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        {video && video.analysisStatus === 'pending' && (
          <button 
            className="analyze-button"
            onClick={handleAnalyzeVideo}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Video'}
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysis; 
