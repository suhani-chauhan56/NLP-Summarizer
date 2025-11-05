import jwt from 'jsonwebtoken';
import { cookieNames } from '../config/jwt.js';

export function authOptional(req, _res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = { id: payload.id, email: payload.email, name: payload.name };
    }
  } catch (_) {}
  next();
}

export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.cookies && req.cookies[cookieNames.access]) return req.cookies[cookieNames.access];
  return null;
}
