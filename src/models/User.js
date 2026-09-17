const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('ADMIN', 'OWNER', 'TENANT', 'FORMER_TENANT', 'GUEST', 'INACTIVE'),
    defaultValue: 'GUEST',
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  profile_picture: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Fields required by Django's AbstractUser schema mapping
  is_superuser: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  first_name: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  last_name: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  is_staff: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  date_joined: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'accounts_user', // Mapping to existing django table if needed, or create new
  timestamps: true,
  paranoid: true, // Soft-deletes
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;
