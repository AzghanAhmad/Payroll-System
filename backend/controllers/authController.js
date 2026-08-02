import crypto from 'crypto';
import User from '../models/User.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendMail } from '../services/emailService.js';

const authResponse = async (user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employee: user.employee,
    },
  };
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw new AppError('Name, email and password are required');
  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email already registered', 409);

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'employee',
  });

  const data = await authResponse(user);
  res.status(201).json(data);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password are required');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }
  if (!user.isActive) throw new AppError('Account is disabled', 403);

  const data = await authResponse(user);
  res.json(data);
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });
  }
  res.json({ message: 'Logged out' });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Invalid refresh token', 401);
  }

  const data = await authResponse(user);
  res.json(data);
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: 'If that email exists, a reset link was sent' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Password Reset',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  } catch {
    // SMTP may be unconfigured in dev
  }

  res.json({
    message: 'If that email exists, a reset link was sent',
    ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError('Token and password required');

  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpire');

  if (!user) throw new AppError('Invalid or expired token', 400);

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({ message: 'Password updated' });
});
