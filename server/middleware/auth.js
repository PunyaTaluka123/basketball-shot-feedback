const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming User model is in models folder

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user; // attach the full user object
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};


const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  //
  if (!token) return res.status(403).json({ message: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(400).json({ message: 'Invalid token' });

    req.user = decoded;
    // Log decoded user info
    next();
  });
};

const verifyCoach = async (req, res, next) => {
  // // Log the user info
  const user = await User.findByPk(req.user.id);
  if (user.role !== 'coach') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  next();
};


module.exports = {authenticate, verifyToken, verifyCoach};
