const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Video = sequelize.define('Video', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Local file path for video processing'
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  uploadDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  analysisResults: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Stored analysis results from Python script'
  },
  analysisStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  }
}, {
  timestamps: true,
  freezeTableName: true
});

// Set up associations
Video.belongsTo(User, { foreignKey: 'playerId', as: 'Player' });
User.hasMany(Video, { foreignKey: 'playerId', as: 'Videos' });

module.exports = Video; 