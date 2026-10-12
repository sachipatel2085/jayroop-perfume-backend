import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import validator from 'validator';
import { User } from '../models/User.js';
import { jwtSecret } from '../middleware/authMiddleware.js';
import { sendPasswordResetMail } from '../services/mailer.js';
import { isValidIndianPhone, isValidPincode } from '../utils/helpers.js';
import { canonicalStateName, findState } from '../utils/indiaStates.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, jwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const validateAddressInput = (body) => {
  const { fullName, phone, addressLine1, city, state, postalCode } = body;
  if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) return 'Please provide all required address fields';
  if (!isValidIndianPhone(phone)) return 'Please enter a valid 10-digit mobile number';
  if (!isValidPincode(postalCode)) return 'Please enter a valid 6-digit PIN code';
  if (!findState(state)) return 'Please select a valid Indian state';
  return null;
};

// @desc    Register a new customer
// @route   POST /api/v1/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }
    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }
    if (phone && !isValidIndianPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    const user = await User.create({
      name: String(name).trim().slice(0, 60),
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '',
      role: 'CUSTOMER',
      marketingOptIn: Boolean(req.body.marketingOptIn),
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user & get token
// @route   POST /api/v1/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { email: email.toLowerCase().replace('@jayrup.com', '@jayroop.com') },
        { email: email.toLowerCase().replace('@jayroop.com', '@jayrup.com') },
      ],
    }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact customer care.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user details
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('wishlist', 'name slug price salePrice images averageRating');

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/v1/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (phone && !isValidIndianPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
    }
    if (name) user.name = String(name).trim().slice(0, 60);
    if (phone !== undefined) user.phone = String(phone).trim();
    if (req.body.marketingOptIn !== undefined) user.marketingOptIn = Boolean(req.body.marketingOptIn);

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        marketingOptIn: user.marketingOptIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add shipping address
// @route   POST /api/v1/auth/addresses
// @access  Private
export const addAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefault,
    } = req.body;

    const invalid = validateAddressInput(req.body);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    if (user.addresses.length >= 10) {
      return res.status(400).json({ success: false, message: 'You can save up to 10 addresses. Please remove one first.' });
    }

    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push({
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state: canonicalStateName(state),
      postalCode: String(postalCode).trim(),
      country: country || 'India',
      isDefault: Boolean(isDefault) || user.addresses.length === 0,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete shipping address
// @route   DELETE /api/v1/auth/addresses/:addressId
// @access  Private
export const deleteAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );
    if (user.addresses.length && !user.addresses.some((a) => a.isDefault)) user.addresses[0].isDefault = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Address removed successfully',
      data: user.addresses,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle wishlist item
// @route   POST /api/v1/auth/wishlist/toggle
// @access  Private
export const toggleWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetIdStr = productId.toString();
    const index = user.wishlist.findIndex(
      (item) => (item?._id ? item._id.toString() : item?.toString()) === targetIdStr
    );
    let action = 'added';

    if (index > -1) {
      user.wishlist.splice(index, 1);
      action = 'removed';
    } else {
      user.wishlist.push(productId);
      action = 'added';
    }

    await user.save();
    await user.populate('wishlist', 'name slug price salePrice images averageRating stock brand category');

    res.status(200).json({
      success: true,
      message: `Product ${action} ${action === 'added' ? 'to' : 'from'} wishlist`,
      data: { wishlist: user.wishlist },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a saved address
// @route   PUT /api/v1/auth/addresses/:addressId
// @access  Private
export const updateAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
    const merged = { ...addr.toObject(), ...req.body };
    const invalid = validateAddressInput(merged);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    ['fullName', 'phone', 'addressLine1', 'addressLine2', 'city', 'postalCode'].forEach((k) => {
      if (req.body[k] !== undefined) addr[k] = String(req.body[k]).trim();
    });
    if (req.body.state !== undefined) addr.state = canonicalStateName(req.body.state);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
      addr.isDefault = true;
    }
    await user.save();
    res.status(200).json({ success: true, message: 'Address updated', data: user.addresses });
  } catch (error) {
    next(error);
  }
};

// @desc    Make an address the default
// @route   PUT /api/v1/auth/addresses/:addressId/default
// @access  Private
export const setDefaultAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) return res.status(404).json({ success: false, message: 'Address not found' });
    user.addresses.forEach((a) => (a.isDefault = false));
    addr.isDefault = true;
    await user.save();
    res.status(200).json({ success: true, data: user.addresses });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (logged in)
// @route   PUT /api/v1/auth/password  { currentPassword, newPassword }
// @access  Private
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide your current and new password' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password updated', data: { token: generateToken(user._id) } });
  } catch (error) {
    next(error);
  }
};

// @desc    Request password reset e-mail
// @route   POST /api/v1/auth/forgot-password  { email }
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const generic = { success: true, message: 'If an account exists for this e-mail, a reset link has been sent.' };
    if (!validator.isEmail(email)) return res.status(200).json(generic);
    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.status(200).json(generic);
    const raw = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    await sendPasswordResetMail(user, raw);
    res.status(200).json(generic);
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with token
// @route   POST /api/v1/auth/reset-password/:token  { password }
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }
    const hashed = crypto.createHash('sha256').update(String(req.params.token)).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: new Date() } }).select('+resetPasswordToken +resetPasswordExpires');
    if (!user) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    const token = generateToken(user._id);
    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      data: { _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, token },
    });
  } catch (error) {
    next(error);
  }
};
