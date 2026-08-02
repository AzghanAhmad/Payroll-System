import User from '../models/User.js';
import { AppError } from './errorMiddleware.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/helpers.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new AppError('Not authorized', 401);

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw new AppError('Not authorized', 401);
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Not authorized — token expired or invalid', 401);
  }
});

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Forbidden', 403));
  }
  next();
};
