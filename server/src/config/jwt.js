import jwt from 'jsonwebtoken';

const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

const isProd = process.env.NODE_ENV === 'production';

export const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
  path: '/',
};

export const cookieNames = {
  access: 'npl_access',
  refresh: 'npl_refresh',
};
