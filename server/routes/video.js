const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { authenticate, verifyToken, verifyCoach } = require('../middleware/auth');
const Video = require('../models/Video');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const ShotError = require('../models/ShotError');

// Trigger video analysis
router.post('/:videoId/analysis', authenticate, async (req, res) => {
  try {
    console.log('Starting video analysis for ID:', req.params.videoId);
    const video = await Video.findByPk(req.params.videoId);
    if (!video) {
      console.log('Video not found:', req.params.videoId);
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user has permission to analyze the video
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      console.log('Unauthorized access attempt:', {
        userId: req.user.id,
        userRole: user.role,
        videoId: video.id,
        videoPlayerId: video.playerId
      });
      return res.status(403).json({ message: 'Not authorized to analyze this video' });
    }

    // Update video status
    await video.update({ analysisStatus: 'processing' });

    // Run Python analysis script
    console.log('Starting Python script with video path:', video.filePath);
    const absolutePath = path.resolve(__dirname, '..', video.filePath);
    console.log('Absolute path:', absolutePath);

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(absolutePath)) {
      console.error('Video file not found at path:', absolutePath);
      await video.update({
        analysisStatus: 'failed',
        analysisResults: { error: 'Video file not found' }
      });
      return res.status(500).json({ 
        message: 'Video file not found',
        path: absolutePath
      });
    }

    // Set PYTHON to use another interpreter (e.g. python3 or a venv path)
    let pythonCommand = process.env.PYTHON || 'python';
  
    console.log('Using Python command:', pythonCommand);
    const scriptPath = path.join(__dirname, '../scripts/analyze_shot.py');
    console.log('Script path:', scriptPath);
    
    if (!fs.existsSync(scriptPath)) {
      console.error('Python script not found at:', scriptPath);
      await video.update({
        analysisStatus: 'failed',
        analysisResults: { error: 'Analysis script not found' }
      });
      return res.status(500).json({ 
        message: 'Analysis script not found',
        path: scriptPath
      });
    }

    console.log('Starting Python process with:', {
      command: pythonCommand,
      script: scriptPath,
      video: absolutePath
    });

    const pythonProcess = spawn(pythonCommand, [scriptPath, absolutePath]);

    let analysisData = '';
    let errorData = '';
    let hasResponded = false;

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Python stdout:', output);
      analysisData += output;
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Python stderr:', error);
      errorData += error;
    });

    pythonProcess.on('error', async (err) => {
      if (hasResponded) return;
      hasResponded = true;
      
      console.error('Failed to start Python process:', err);
      console.error('Error details:', {
        command: pythonCommand,
        scriptPath,
        videoPath: absolutePath,
        error: err.message
      });
      
      await video.update({
        analysisStatus: 'failed',
        analysisResults: { error: `Failed to start Python process: ${err.message}` }
      });
      
      res.status(500).json({ 
        message: 'Failed to start video analysis',
        error: err.message,
        details: {
          command: pythonCommand,
          scriptPath,
          videoPath: absolutePath
        }
      });
    });

    pythonProcess.on('close', async (code) => {
      if (hasResponded) return;
      hasResponded = true;

      console.log('Python process exited with code:', code);
      console.log('Final stdout:', analysisData);
      console.log('Final stderr:', errorData);

      if (code !== 0) {
        console.error('Analysis failed with code:', code);
        console.error('Error data:', errorData);
        await video.update({
          analysisStatus: 'failed',
          analysisResults: { error: errorData }
        });
        return res.status(500).json({ 
          message: 'Error analyzing video',
          error: errorData
        });
      }

      try {
        const cleanOutput = analysisData.trim();
        console.log('Attempting to parse analysis data:', cleanOutput);
        const analysis = JSON.parse(cleanOutput);
        await video.update({
          analysisStatus: 'completed',
          analysisResults: analysis
        });

        // Save error data to ShotError table
        if (analysis.error_data && Array.isArray(analysis.error_data)) {
          const errorRows = analysis.error_data.map(e => ({
            userId: video.playerId,
            videoId: video.id,
            frameNumber: e.frame_number,
            timestamp: e.timestamp,
            wristError: e.wrist_error,
            shoulderError: e.shoulder_error,
            elbowError: e.elbow_error,
            collectiveError: e.collective_error
          }));
          await ShotError.bulkCreate(errorRows);
        }

        res.json({ message: 'Analysis completed successfully' });
      } catch (err) {
        console.error('Error parsing analysis results:', err);
        console.error('Raw analysis data:', analysisData);
        await video.update({
          analysisStatus: 'failed',
          analysisResults: { error: 'Error parsing analysis results' }
        });
        res.status(500).json({ 
          message: 'Error parsing analysis results',
          error: err.message,
          rawData: analysisData
        });
      }
    });
  } catch (err) {
    console.error('Server error in video analysis:', err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message
    });
  }
});

// Get video analysis
router.get('/:videoId/analysis', authenticate, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user has permission to view the video
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this video' });
    }

    // Return the stored analysis results
    if (video.analysisStatus === 'completed' && video.analysisResults) {
      res.json(video.analysisResults);
    } else {
      res.status(404).json({ message: 'Analysis not available' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add feedback to video
router.post('/:videoId/feedback', authenticate, verifyCoach, async (req, res) => {
  try {
    const { content, timestamp } = req.body;
    const video = await Video.findByPk(req.params.videoId);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const feedback = await Feedback.create({
      videoId: video.id,
      coachId: req.user.id,
      playerId: video.playerId,
      content,
      timestamp
    });

    res.status(201).json(feedback);
  } catch (err) {
    console.error('Error creating feedback:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get feedback for a video
router.get('/:videoId/feedback', authenticate, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user has permission to view feedback
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view feedback' });
    }

    const feedback = await Feedback.findAll({
      where: { videoId: video.id },
      include: [{
        model: User,
        as: 'coach',
        attributes: ['id', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(feedback);
  } catch (err) {
    console.error('Error fetching feedback:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get shot error data for a video
router.get('/:videoId/errors', authenticate, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this video' });
    }
    const errors = await ShotError.findAll({
      where: { videoId: video.id },
      order: [['frameNumber', 'ASC']]
    });
    res.json(errors);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; 