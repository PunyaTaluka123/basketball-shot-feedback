const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Video = require('./Video');

const ShotError = sequelize.define('ShotError', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  videoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Video,
      key: 'id'
    }
  },
  frameNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  wristError: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  shoulderError: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  elbowError: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  collectiveError: {
    type: DataTypes.FLOAT,
    allowNull: false
  }
}, {
  timestamps: true,
  freezeTableName: true
});

ShotError.belongsTo(User, { foreignKey: 'userId', as: 'User' });
ShotError.belongsTo(Video, { foreignKey: 'videoId', as: 'Video' });
User.hasMany(ShotError, { foreignKey: 'userId', as: 'ShotErrors' });
Video.hasMany(ShotError, { foreignKey: 'videoId', as: 'ShotErrors' });

module.exports = ShotError; 