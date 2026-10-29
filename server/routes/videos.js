const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { authenticate, verifyToken } = require('../middleware/auth');
const Video = require('../models/Video');
const User = require('../models/User');
const { Op } = require('sequelize');
const ShotError = require('../models/ShotError');

const formatMetric = (value, decimals = 2) => {
  return typeof value === 'number' && !Number.isNaN(value) ? value.toFixed(decimals) : 'N/A';
};

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const renderVideoSummaryTable = (doc, summaries) => {
  if (!summaries.length) return;

  const margins = doc.page.margins || { left: 50, right: 50, top: 50, bottom: 50 };
  const startY = doc.y;
  let y = startY;
  const headerHeight = 28;
  const minRowHeight = 26;
  const xStart = margins.left;
  const usableWidth = doc.page.width - margins.left - margins.right;

  const columnDefinitions = [
    { header: 'Video', ratio: 0.28, align: 'left' },
    { header: 'Upload Date', ratio: 0.18, align: 'left' },
    { header: 'Average Form Error', ratio: 0.16, align: 'center' },
    { header: 'Mechanics Snapshot', ratio: 0.26, align: 'left' },
    { header: 'Shot Type', ratio: 0.12, align: 'center' }
  ];

  const columnWidths = columnDefinitions.map((col, index) => {
    if (index === columnDefinitions.length - 1) {
      const used = columnDefinitions.slice(0, -1).reduce((sum, def, idx) => sum + Math.round(def.ratio * usableWidth), 0);
      return usableWidth - used;
    }
    return Math.round(col.ratio * usableWidth);
  });

  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  const drawHeader = () => {
    doc.save();
    doc.fillColor('#12355b').rect(xStart, y, totalWidth, headerHeight).fill();
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
    let x = xStart;
    columnDefinitions.forEach((col, idx) => {
      const width = columnWidths[idx];
      doc.text(col.header, x + 8, y + 8, {
        width: width - 16,
        align: col.align || 'left'
      });
      x += width;
    });
    doc.restore();
    doc.lineWidth(0.5).strokeColor('#0f3057').moveTo(xStart, y + headerHeight).lineTo(xStart + totalWidth, y + headerHeight).stroke();
    y += headerHeight;
  };

  const ensureSpace = (requiredHeight) => {
    if (y + requiredHeight > doc.page.height - margins.bottom) {
      doc.addPage();
      y = doc.page.margins ? doc.page.margins.top : 50;
      doc.x = doc.page.margins?.left ?? 50;
      drawHeader();
      doc.font('Helvetica').fontSize(10).fillColor('#1f2933');
    }
  };

  drawHeader();
  doc.fontSize(10).font('Helvetica');

  summaries.forEach((summary, rowIndex) => {
    const rowValues = [
      `${summary.order}. ${summary.title}`,
      formatDate(summary.uploadDate),
      formatMetric(summary.avgCollective),
      summary.mechanicsSnapshot,
      summary.jumpType || 'Unknown'
    ];

    const columnHeights = rowValues.map((value, idx) => {
      const width = columnWidths[idx] - 16;
      const align = columnDefinitions[idx].align || 'left';
      return doc.heightOfString(value, {
        width,
        align,
        lineGap: 2
      });
    });

    const currentRowHeight = Math.max(minRowHeight, Math.max(...columnHeights) + 12);
    ensureSpace(currentRowHeight);

    const backgroundColor = rowIndex % 2 === 0 ? '#f4f7fb' : '#ffffff';
    doc.save();
    doc.fillColor(backgroundColor).rect(xStart, y, totalWidth, currentRowHeight).fill();
    doc.restore();

    doc.strokeColor('#d0d5dd').lineWidth(0.5).moveTo(xStart, y + currentRowHeight).lineTo(xStart + totalWidth, y + currentRowHeight).stroke();

    let x = xStart;
    doc.font('Helvetica').fontSize(10).fillColor('#1f2933');

    rowValues.forEach((value, idx) => {
      const width = columnWidths[idx];
      const align = columnDefinitions[idx].align || 'left';
      doc.text(value, x + 8, y + 6, {
        width: width - 16,
        align,
        lineGap: 2
      });
      x += width;
    });

    y += currentRowHeight;
  });

  doc.y = y + 12;
  doc.fillColor('#1f2933').font('Helvetica');
};

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'videos');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      console.log('Upload directory:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('Received file:', file.originalname, 'MIME type:', file.mimetype);
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Upload video file
router.post('/upload', authenticate, upload.single('video'), (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Request file:', req.file);
    console.log('Request body:', req.body);

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ message: 'No video file uploaded' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;
    const filePath = `uploads/videos/${req.file.filename}`;
    
    console.log('Video URL:', videoUrl);
    console.log('File path:', filePath);

    // Verify file exists
    const absolutePath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(absolutePath)) {
      console.error('File not found at path:', absolutePath);
      return res.status(500).json({ message: 'Error: Uploaded file not found' });
    }

    res.json({ videoUrl, filePath });
  } catch (error) {
    console.error('Error in upload route:', error);
    res.status(500).json({ 
      message: 'Error uploading video',
      error: error.message 
    });
  }
});

// Save video information and start analysis
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, videoUrl, filePath } = req.body;
    console.log('Creating video for user:', req.user.id);

    // 🔐 Ensure user exists in DB before using as foreign key
    const player = await User.findByPk(req.user.id);
    if (!player) {
      console.log('User not found:', req.user.id);
      return res.status(400).json({ message: 'Invalid user. Please re-login.' });
    }

    console.log('Found player:', {
      id: player.id,
      email: player.email,
      role: player.role
    });

    const video = await Video.create({
      title,
      description,
      videoUrl,
      filePath,
      playerId: req.user.id,
      analysisStatus: 'pending'
    });

    console.log('Created video:', {
      id: video.id,
      playerId: video.playerId,
      title: video.title
    });

    res.status(201).json(video);
  } catch (error) {
    console.error('Save video error:', error);
    res.status(500).json({ message: 'Error saving video information' });
  }
});

// Get videos for a player
router.get('/player', authenticate, async (req, res) => {
  console.log("player videos route called");
  console.log("User ID:", req.user.id);
  try {
    const videos = await Video.findAll({
      where: { playerId: req.user.id },
      order: [['uploadDate', 'DESC']],
      include: [{
        model: User,
        as: 'Player',
        attributes: ['email']
      }]
    });
    console.log("Found videos:", videos.length);
    res.json(videos);
  } catch (error) {
    console.error("Error in player videos route:", error);
    res.status(500).json({ message: 'Error fetching videos' });
  }
});

// Get videos for a coach (videos from their players)
router.get('/coach', authenticate, async (req, res) => {
  try {
    console.log('Coach videos route called for user:', req.user.id);
    
    const coach = await User.findByPk(req.user.id);
    if (coach.role !== 'coach') {
      console.log('User is not a coach:', coach.role);
      return res.status(403).json({ message: 'Only coaches can access this endpoint' });
    }

    // Find all players assigned to this coach (both accepted and pending)
    const players = await User.findAll({
      where: { 
        [Op.or]: [
          { coachId: req.user.id },
          { pendingCoachId: req.user.id }
        ],
        role: 'player'
      }
    });

    console.log('Found players:', players.length);

    if (players.length === 0) {
      console.log('No players found for coach');
      return res.json([]);
    }

    const playerIds = players.map(player => player.id);
    console.log('Player IDs:', playerIds);

    const videos = await Video.findAll({
      where: { playerId: playerIds },
      include: [{
        model: User,
        as: 'Player',
        attributes: ['email']
      }],
      order: [['uploadDate', 'DESC']]
    });

    console.log('Found videos:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('Error in coach videos route:', error);
    res.status(500).json({ message: 'Error fetching videos' });
  }
});

// Get single video with analysis
router.get('/:id', authenticate, async (req, res) => {
  try {
    console.log('Fetching video with ID:', req.params.id);
    console.log('Authenticated user:', req.user);

    const video = await Video.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'Player',
        attributes: ['email']
      }]
    });

    if (!video) {
      console.log('Video not found');
      return res.status(404).json({ message: 'Video not found' });
    }

    console.log('Found video:', {
      id: video.id,
      playerId: video.playerId,
      currentUserId: req.user.id
    });

    // Check if user has permission to view the video
    const user = await User.findByPk(req.user.id);
    console.log('User role:', user.role);
    
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      console.log('Authorization failed:', {
        userRole: user.role,
        videoPlayerId: video.playerId,
        userId: req.user.id
      });
      return res.status(403).json({ message: 'Not authorized to view this video' });
    }

    res.json(video);
  } catch (error) {
    console.error('Error in single video route:', error);
    res.status(500).json({ message: 'Error fetching video' });
  }
});

// Analyze video manually
router.post('/:id/analyze', authenticate, async (req, res) => {
  try {
    const video = await Video.findByPk(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user has permission to analyze the video
    const user = await User.findByPk(req.user.id);
    if (user.role !== 'coach' && video.playerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to analyze this video' });
    }

    // Update video status
    await video.update({ analysisStatus: 'processing' });

    // Start video analysis in background
    const pythonProcess = spawn(process.env.PYTHON || 'python', [
      path.join(__dirname, '../scripts/analyze_shot.py'),
      video.filePath
    ]);

    let analysisData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      analysisData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        await video.update({
          analysisStatus: 'failed',
          analysisResults: { error: errorData }
        });
        return;
      }

      try {
        const analysis = JSON.parse(analysisData);
        await video.update({
          analysisStatus: 'completed',
          analysisResults: analysis
        });
      } catch (err) {
        await video.update({
          analysisStatus: 'failed',
          analysisResults: { error: 'Error parsing analysis results' }
        });
      }
    });

    res.json({ message: 'Video analysis started' });
  } catch (error) {
    console.error('Error in analyze route:', error);
    res.status(500).json({ message: 'Error starting video analysis' });
  }
});

// Get average collective error for each video for the current player
router.get('/player/progress', authenticate, async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: { playerId: req.user.id, analysisStatus: 'completed' },
      order: [['uploadDate', 'ASC']],
      attributes: ['id', 'title', 'uploadDate']
    });
    const progress = [];
    for (const video of videos) {
      const errors = await ShotError.findAll({
        where: { videoId: video.id },
        attributes: ['collectiveError']
      });
      if (errors.length > 0) {
        const avgError = errors.reduce((sum, e) => sum + e.collectiveError, 0) / errors.length;
        progress.push({
          videoId: video.id,
          title: video.title,
          uploadDate: video.uploadDate,
          avgCollectiveError: avgError
        });
      }
    }
    res.json(progress);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Generate PDF report for player's analyzed videos
router.get('/player/report/pdf', authenticate, async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: { playerId: req.user.id, analysisStatus: 'completed' },
      include: [{
        model: ShotError,
        as: 'ShotErrors',
        attributes: ['wristError', 'shoulderError', 'elbowError', 'collectiveError', 'timestamp']
      }],
      order: [['uploadDate', 'ASC']]
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=student_report.pdf');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('Student Performance Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    if (videos.length === 0) {
      doc.fontSize(12).text('No analyzed videos available for this player.');
      doc.end();
      return;
    }

    const progressData = [];
    const videoSummaries = [];

    videos.forEach((video, index) => {
      const uploadDate = video.uploadDate ? new Date(video.uploadDate) : null;
      const errors = Array.isArray(video.ShotErrors) ? video.ShotErrors : [];
      const safeAverage = (key) => {
        if (!errors.length) return null;
        const total = errors.reduce((sum, row) => sum + (typeof row[key] === 'number' ? row[key] : 0), 0);
        return total / errors.length;
      };

      const avgCollective = safeAverage('collectiveError');
      const avgElbow = safeAverage('elbowError');
      const avgShoulder = safeAverage('shoulderError');
      const avgWrist = safeAverage('wristError');

      progressData.push({
        uploadDate,
        avgCollective: typeof avgCollective === 'number' ? avgCollective : null
      });

      let analysis = null;
      if (video.analysisResults) {
        if (typeof video.analysisResults === 'string') {
          try {
            analysis = JSON.parse(video.analysisResults);
          } catch (parseErr) {
            console.error('Error parsing analysis results JSON:', parseErr);
          }
        } else {
          analysis = video.analysisResults;
        }
      }

      const suggestionSet = new Set();
      let releaseAngles = null;
      let jumpType = null;
      let jumpLift = null;

      if (analysis && typeof analysis === 'object') {
        const release = analysis.release_angles || analysis.releaseAngles;
        if (release) {
          const elbow = Number(release.elbow);
          const shoulder = Number(release.shoulder);
          const wrist = Number(release.wrist);
          releaseAngles = {
            elbow: Number.isFinite(elbow) ? elbow : null,
            shoulder: Number.isFinite(shoulder) ? shoulder : null,
            wrist: Number.isFinite(wrist) ? wrist : null
          };
        }

        const jump = analysis.jump;
        if (jump && typeof jump === 'object') {
          jumpType = jump.type || null;
          if (Number.isFinite(jump.max_vertical_displacement_px)) {
            jumpLift = jump.max_vertical_displacement_px;
          }
        }

        const frames = Array.isArray(analysis.frames) ? analysis.frames : [];
        frames.forEach((frame) => {
          if (frame && Array.isArray(frame.suggestions)) {
            frame.suggestions.forEach((suggestion) => suggestionSet.add(suggestion));
          }
        });
      }

      const mechanicsParts = [];
      if (avgElbow !== null) mechanicsParts.push(`Elbow ${formatMetric(avgElbow)}`);
      if (avgShoulder !== null) mechanicsParts.push(`Shoulder ${formatMetric(avgShoulder)}`);
      if (avgWrist !== null) mechanicsParts.push(`Wrist ${formatMetric(avgWrist)}`);
      const rawSuggestions = Array.from(suggestionSet);
      const selectedSuggestions = rawSuggestions.length > 2
        ? rawSuggestions
            .map((text) => ({ text, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .slice(0, 2)
            .map((item) => item.text)
        : rawSuggestions;

      const mechanicsSnapshot = mechanicsParts.length ? mechanicsParts.join('\n') : 'Not captured';

      videoSummaries.push({
        order: index + 1,
        title: video.title || 'Untitled Video',
        uploadDate,
        avgCollective,
        avgElbow,
        avgShoulder,
        avgWrist,
        mechanicsSnapshot,
        jumpType: jumpType,
        jumpLift,
        release: releaseAngles,
        suggestions: selectedSuggestions
      });
    });

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#12355b').text('Game Film Breakdown', { underline: true });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(11).fillColor('#1f2933');
  renderVideoSummaryTable(doc, videoSummaries);
  doc.x = doc.page.margins?.left ?? 50;

  if (doc.y > doc.page.height - (doc.page.margins?.bottom ?? 50) - 120) {
    doc.addPage();
    doc.x = doc.page.margins?.left ?? 50;
  }
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#12355b').text('Deep Dive & Coaching Notes', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor('#1f2933');

    const ensureDetailSpace = (minHeight = 120) => {
      const bottomMargin = doc.page.margins?.bottom ?? 50;
      if (doc.y + minHeight > doc.page.height - bottomMargin) {
        doc.addPage();
        doc.x = doc.page.margins?.left ?? 50;
        doc.font('Helvetica').fontSize(11).fillColor('#1f2933');
      }
    };

    videoSummaries.forEach((summary) => {
      ensureDetailSpace();
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#12355b').text(`${summary.order}. ${summary.title}`);
      doc.font('Helvetica').fontSize(11).fillColor('#1f2933');
      doc.text(`Uploaded: ${formatDateTime(summary.uploadDate)}`);
      doc.text(`Average Form Error: ${formatMetric(summary.avgCollective)}`);

      const mechanicsDetails = [];
      if (summary.avgElbow !== null) mechanicsDetails.push(`Elbow control ${formatMetric(summary.avgElbow)}`);
      if (summary.avgShoulder !== null) mechanicsDetails.push(`Shoulder alignment ${formatMetric(summary.avgShoulder)}`);
      if (summary.avgWrist !== null) mechanicsDetails.push(`Wrist follow-through ${formatMetric(summary.avgWrist)}`);
      if (mechanicsDetails.length) {
        doc.text(`Mechanics Focus: ${mechanicsDetails.join(' | ')}`);
      }

      if (summary.release) {
        const releaseParts = [];
        if (summary.release.elbow !== null) releaseParts.push(`Elbow ${summary.release.elbow.toFixed(1)} deg`);
        if (summary.release.shoulder !== null) releaseParts.push(`Shoulder ${summary.release.shoulder.toFixed(1)} deg`);
        if (summary.release.wrist !== null) releaseParts.push(`Wrist ${summary.release.wrist.toFixed(1)} deg`);
        if (releaseParts.length) {
          doc.text(`Release Benchmarks: ${releaseParts.join(' | ')}`);
        }
      }

      if (summary.jumpType || Number.isFinite(summary.jumpLift)) {
        const liftText = Number.isFinite(summary.jumpLift) ? ` (Lift off: ${summary.jumpLift.toFixed(0)} px)` : '';
        doc.text(`Shot Type: ${(summary.jumpType || 'Unknown')}${liftText}`);
      }

      if (summary.suggestions && summary.suggestions.length) {
        doc.text('Coaching Cues:');
        doc.list(summary.suggestions, {
          bulletRadius: 2,
          textIndent: 14,
          bulletIndent: 8
        });
      }

      doc.moveDown();
    });

    const usableProgress = progressData.filter((entry) => entry.avgCollective !== null);
    doc.addPage();
    doc.x = doc.page.margins?.left ?? 50;
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#12355b').text('All-Time Shooting Report', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12).fillColor('#1f2933').text(`Total Analyzed Videos: ${videos.length}`);

    if (usableProgress.length > 0) {
      const sortedProgress = usableProgress
        .map((entry, idx) => ({ ...entry, order: idx }))
        .sort((a, b) => {
          if (a.uploadDate && b.uploadDate) return a.uploadDate - b.uploadDate;
          if (a.uploadDate) return -1;
          if (b.uploadDate) return 1;
          return a.order - b.order;
        });

      const first = sortedProgress[0];
      const last = sortedProgress[sortedProgress.length - 1];
      const improvement = first && last ? first.avgCollective - last.avgCollective : null;
      const averageError = sortedProgress.reduce((sum, entry) => sum + entry.avgCollective, 0) / sortedProgress.length;
      const best = sortedProgress.reduce((prev, current) => (
        prev.avgCollective <= current.avgCollective ? prev : current
      ));

      doc.text(`Starting Average Form Error: ${formatMetric(first.avgCollective)}`);
      doc.text(`Latest Average Form Error: ${formatMetric(last.avgCollective)}`);
      if (improvement !== null) {
        const trend = improvement >= 0 ? 'Improvement' : 'Regression';
        const improvementText = `${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)} form error`;
        doc.text(`All-time ${trend}: ${improvementText}`);
      }
      doc.text(`Overall Average Form Error: ${formatMetric(averageError)}`);
      if (best.uploadDate) {
        doc.text(`Sharpest Release Date: ${best.uploadDate.toLocaleDateString()}`);
      }
      doc.text(`Best Recorded Form Error: ${formatMetric(best.avgCollective)}`);
    } else {
      doc.text('Not enough error data to calculate improvement metrics.');
    }

    const jointTotals = {
      elbow: { sum: 0, count: 0 },
      shoulder: { sum: 0, count: 0 },
      wrist: { sum: 0, count: 0 }
    };
    const releaseTotals = {
      elbow: { sum: 0, count: 0 },
      shoulder: { sum: 0, count: 0 },
      wrist: { sum: 0, count: 0 }
    };
    videoSummaries.forEach((summary) => {
      if (typeof summary.avgElbow === 'number') {
        jointTotals.elbow.sum += summary.avgElbow;
        jointTotals.elbow.count += 1;
      }
      if (typeof summary.avgShoulder === 'number') {
        jointTotals.shoulder.sum += summary.avgShoulder;
        jointTotals.shoulder.count += 1;
      }
      if (typeof summary.avgWrist === 'number') {
        jointTotals.wrist.sum += summary.avgWrist;
        jointTotals.wrist.count += 1;
      }
      if (summary.release && typeof summary.release.elbow === 'number' && !Number.isNaN(summary.release.elbow)) {
        releaseTotals.elbow.sum += summary.release.elbow;
        releaseTotals.elbow.count += 1;
      }
      if (summary.release && typeof summary.release.shoulder === 'number' && !Number.isNaN(summary.release.shoulder)) {
        releaseTotals.shoulder.sum += summary.release.shoulder;
        releaseTotals.shoulder.count += 1;
      }
      if (summary.release && typeof summary.release.wrist === 'number' && !Number.isNaN(summary.release.wrist)) {
        releaseTotals.wrist.sum += summary.release.wrist;
        releaseTotals.wrist.count += 1;
      }
    });

    const bestShot = videoSummaries.filter((summary) => typeof summary.avgCollective === 'number')
      .reduce((prev, current) => {
        if (!prev) return current;
        return current.avgCollective < prev.avgCollective ? current : prev;
      }, null);

    const worstShot = videoSummaries.filter((summary) => typeof summary.avgCollective === 'number')
      .reduce((prev, current) => {
        if (!prev) return current;
        return current.avgCollective > prev.avgCollective ? current : prev;
      }, null);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#12355b').text('All-Time Mechanics Snapshot', { underline: true });
    if (jointTotals.elbow.count + jointTotals.shoulder.count + jointTotals.wrist.count > 0) {
      doc.font('Helvetica').fontSize(12).fillColor('#1f2933');
      if (jointTotals.elbow.count > 0) {
        doc.text(`  - Elbow Tuck Control (avg): ${formatMetric(jointTotals.elbow.sum / jointTotals.elbow.count)}`);
      }
      if (jointTotals.shoulder.count > 0) {
        doc.text(`  - Shooting Line Consistency (avg): ${formatMetric(jointTotals.shoulder.sum / jointTotals.shoulder.count)}`);
      }
      if (jointTotals.wrist.count > 0) {
        doc.text(`  - Follow-Through Snap (avg): ${formatMetric(jointTotals.wrist.sum / jointTotals.wrist.count)}`);
      }
    } else {
      doc.font('Helvetica').fontSize(12).fillColor('#1f2933').text('  - Not enough data to summarize joint mechanics.');
    }

    if (releaseTotals.elbow.count + releaseTotals.shoulder.count + releaseTotals.wrist.count > 0) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#12355b').text('  Release Point Benchmarks:');
      doc.font('Helvetica').fontSize(12).fillColor('#1f2933');
      if (releaseTotals.elbow.count > 0) {
        doc.text(`    - Elbow Slot Angle: ${(releaseTotals.elbow.sum / releaseTotals.elbow.count).toFixed(1)} deg`);
      }
      if (releaseTotals.shoulder.count > 0) {
        doc.text(`    - Shoulder Arc: ${(releaseTotals.shoulder.sum / releaseTotals.shoulder.count).toFixed(1)} deg`);
      }
      if (releaseTotals.wrist.count > 0) {
        doc.text(`    - Wrist Flick Angle: ${(releaseTotals.wrist.sum / releaseTotals.wrist.count).toFixed(1)} deg`);
      }
    }

    doc.moveDown(0.5);
    if (bestShot || worstShot) {
      doc.font('Helvetica').fontSize(12).fillColor('#1f2933');
      if (bestShot) {
        doc.text(`  Sharpest Clip: ${bestShot.title} (${formatMetric(bestShot.avgCollective)} form error)`);
      }
      if (worstShot) {
        doc.text(`  Toughest Clip: ${worstShot.title} (${formatMetric(worstShot.avgCollective)} form error)`);
      }
    }

    doc.moveDown();
    doc.font('Helvetica').fontSize(12).fillColor('#1f2933').text('Keep reviewing individual video suggestions to continue improving over time.');
    doc.end();
  } catch (err) {
    console.error('Error generating player PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating report', error: err.message });
    } else {
      res.end();
    }
  }
});

module.exports = router; 
