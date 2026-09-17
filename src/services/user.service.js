const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

const updateUserById = async (id, updateBody) => {
  const user = await getUserById(id);
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

const archiveTenant = async (id) => {
  const user = await getUserById(id);
  if (user.role !== 'TENANT') {
    throw new ApiError(400, 'Only active tenants can be archived');
  }
  user.role = 'FORMER_TENANT';
  await user.save();
  return user;
};

const deleteUser = async (id) => {
  const user = await getUserById(id);
  user.is_active = false;
  user.role = 'INACTIVE';
  await user.save();
  await user.destroy(); // soft delete via paranoid
  return user;
};

module.exports = {
  getUserById,
  updateUserById,
  archiveTenant,
  deleteUser,
};
