const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const {authenticate, verifyToken, verifyCoach } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  const { email, password, role, coachId, age } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    if (role === 'player') {
      if (!age || isNaN(parseInt(age)) || parseInt(age) < 1) {
        return res.status(400).json({ message: 'Valid age is required for players' });
      }
    }
    const hashedPassword = await bcrypt.hash(password, 10); 
    const user = await User.create({ email, password: hashedPassword, role, coachId, age: role === 'player' ? age : null });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Email verification endpoint


// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        coachId: user.coachId 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// router.post('/join-coach', authenticate, async (req, res) => {
//   const { coachId } = req.body;
//   try {
//     const coachExists = await User.findOne({ where: { id: coachId, role: 'coach' } });
//     if (!coachExists) return res.status(404).json({ message: 'Coach not found' });

//     const player = await User.findByPk(req.user.id);
//     player.coachId = coachId;
//     await player.save();

//     res.status(200).json({ message: 'Coach assigned successfully' });
//   } catch (err) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/players', verifyToken, verifyCoach, async (req, res) => {
  try {
    const players = await User.findAll({
      where: { 
        coachId: req.user.id,
        role: 'player'
      },
      attributes: ['id', 'email', 'coachId', 'pendingCoachId', 'age']
    });
    
    res.status(200).json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/players', verifyToken, verifyCoach, async (req, res) => {
  console.log("players POSE Started")
  const { playerEmail } = req.body;
  // console.log(req.body);


  try {
    const player = await User.findOne({ where: { email: playerEmail, role: 'player' } });
    // console.log(player);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    if (player.coachId) {
      return res.status(400).json({ message: 'Player is already assigned to a coach' });
    }

    if (player.pendingCoachId === req.user.id) {
      return res.status(200).json({ 
        message: 'Invitation sent successfully',
        player: {
          id: player.id,
          email: player.email,
          coachId: player.coachId,
          pendingCoachId: player.pendingCoachId
        }
      });
      
    }

    player.pendingCoachId = req.user.id;
    await player.save();

    res.status(200).json({ message: 'Invitation sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/pending-invitation', authenticate, async (req, res) => {
  try {
    console.log("in pending");

    const player = await User.findByPk(req.user.id);

    if (!player.pendingCoachId) {
      return res.status(404).json({ message: 'No pending invitation' });
    }

    const coach = await User.findByPk(player.pendingCoachId);
    res.status(200).json({ coach: { id: coach.id, email: coach.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/respond-invitation', authenticate, async (req, res) => {
  const { action } = req.body; // 'accept' or 'reject'

  try {
    const player = await User.findByPk(req.user.id);

    if (!player.pendingCoachId) {
      return res.status(400).json({ message: 'No pending invitation to respond to' });
    }

    if (action === 'accept') {
      player.coachId = player.pendingCoachId;
      player.pendingCoachId = null;
    } else if (action === 'reject') {
      player.pendingCoachId = null;
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await player.save();
    res.status(200).json({ message: `Invitation ${action}ed successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/leave-coach', authenticate, async (req, res) => {
  const player = await User.findByPk(req.user.id);
  if (player.role !== 'player') return res.status(403).json({ message: 'Only players can leave coaches' });

  player.coachId = null;
  await player.save();
  res.json({ message: 'You have left the coach' });
});

// DELETE /players/:id - Remove a player from coach's list
router.delete('/players/:id', verifyToken, verifyCoach, async (req, res) => {
  try {
    const player = await User.findOne({
      where: {
        id: req.params.id,
        coachId: req.user.id,
        role: 'player'
      }
    });
    if (!player) {
      return res.status(404).json({ message: 'Player not found or not assigned to you.' });
    }
    player.coachId = null;
    await player.save();
    res.status(200).json({ message: 'Player removed from your list.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const coach = await User.findByPk(req.params.id);

    if (!coach || coach.role !== 'coach') {
      return res.status(404).json({ message: 'Coach not found' });
    }

    res.json({ email: coach.email });
  } catch (err) {
    console.error('Error fetching coach:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router; 