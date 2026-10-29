const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Video = require('./Video');
const User = require('./User');

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  videoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Video',
      key: 'id'
    }
  },
  coachId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Timestamp in the video where feedback applies'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  freezeTableName: true
});

// Set up associations
Feedback.belongsTo(Video, { foreignKey: 'videoId' });
Feedback.belongsTo(User, { foreignKey: 'coachId', as: 'coach' });
Feedback.belongsTo(User, { foreignKey: 'playerId', as: 'player' });

module.exports = Feedback; 