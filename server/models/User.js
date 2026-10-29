const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('player', 'coach'),
    defaultValue: 'player'
  },
  coachId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'User', // must match the table name if using freezeTableName
      key: 'id'
    }
  },
  pendingCoachId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true, // Only required for players, not coaches
  }
}, {
  timestamps: true,
  freezeTableName: true // important to match model/table name in 'model' above
});

User.hasMany(User, { foreignKey: 'coachId', as: 'Players' });
User.belongsTo(User, { foreignKey: 'coachId', as: 'Coach' });

module.exports = User;
