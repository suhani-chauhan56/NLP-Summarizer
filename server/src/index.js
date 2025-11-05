import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import summariesRouter from './routes/summaries.js';

const app = express();

// ✅ Allow CORS only from your frontend domain (no trailing slash!)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://nlp-summarizer-m2dz.vercel.app';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// ✅ Security & parsing middlewares
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ✅ Rate limiter (avoid too many requests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use(limiter);

// ✅ Routes
app.get('/', (req, res) => res.send('Server is running ✅'));
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/reports', reportsRouter);
app.use('/summaries', summariesRouter);

// ✅ Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ✅ MongoDB connection
if (!mongoose.connection.readyState) {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (MONGODB_URI) {
    mongoose
      .connect(MONGODB_URI)
      .then(() => console.log('✅ MongoDB connected'))
      .catch((err) => console.error('❌ MongoDB error:', err.message));
  } else {
    console.warn('⚠️ MONGODB_URI missing');
  }
}

// ✅ For Vercel (export default)
// Vercel expects a function export (not .listen)
export default app;

// ✅ For local development (run `npm run dev`)
const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));

