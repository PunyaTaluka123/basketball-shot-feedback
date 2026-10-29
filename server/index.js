const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const videosRoutes = require('./routes/videos');
const sequelize = require('./config/database');
const videoRoutes = require('./routes/video');

dotenv.config();

// Set default JWT secret if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'default-jwt-secret-for-development';
  console.warn('Warning: Using default JWT secret. Set JWT_SECRET in environment for production.');
}
const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

app.use(cors());
app.use(express.json());// Test route to confirm server is running
app.get('/', (req, res) => {
  res.send('Server is running!');
});
app.use(cors({
  origin: 'http://localhost:3000', // frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/coach', authRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/video', videoRoutes);

// Sync Sequelize models and start server
const PORT = process.env.PORT || 3001;

sequelize.sync().then(() => {
  console.log('Database & tables created!');
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Keep the process visibly alive

  
}).catch(err => console.error('❌ Sequelize sync error:', err));

// Catch unhandled errors
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});
