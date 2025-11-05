import { Router } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { signupSchema, loginSchema } from '../validators/auth.js';
import { cookieNames, cookieOptions, signAccessToken, signRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Info endpoint to avoid "Cannot GET /auth"
router.get('/', async (_req, res) => {
  return res.json({ ok: true, usage: ['POST /auth/signup', 'POST /auth/login', 'POST /auth/logout', 'GET /auth/me', 'POST /auth/refresh'] });
});

router.post('/signup', async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
    const { name, email, password } = parsed.data;

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const payload = { id: user._id.toString(), email: user.email, name: user.name };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    res.cookie(cookieNames.access, access, cookieOptions);
    res.cookie(cookieNames.refresh, refresh, cookieOptions);
    return res.status(201).json({ user: payload, access, refresh });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid credentials' });
    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const payload = { id: user._id.toString(), email: user.email, name: user.name };
    const access = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    res.cookie(cookieNames.access, access, cookieOptions);
    res.cookie(cookieNames.refresh, refresh, cookieOptions);
    return res.json({ user: payload, access, refresh });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', async (_req, res) => {
  res.clearCookie(cookieNames.access, { ...cookieOptions, maxAge: 0 });
  res.clearCookie(cookieNames.refresh, { ...cookieOptions, maxAge: 0 });
  return res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.[cookieNames.refresh];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const newAccess = signAccessToken({ id: user._id.toString(), email: user.email, name: user.name });
    res.cookie(cookieNames.access, newAccess, cookieOptions);
    return res.json({ ok: true });
  } catch (_e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

export default router;
